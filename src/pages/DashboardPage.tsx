import { useEffect, useMemo, useRef, useState } from "react";
import { AddFamilyMemberDialog } from "../components/family-tree/AddFamilyMemberDialog";
import { FamilyTreeCanvas } from "../components/family-tree/FamilyTreeCanvas";
import { MemberDetailsPanel } from "../components/family-tree/MemberDetailsPanel";
import { EditPersonDialog } from "../components/family-tree/EditPersonDialog";
import { TreeToolbar } from "../components/family-tree/TreeToolbar";
import { PersonName } from "../components/family-tree/PersonName";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { RelationshipChangeDialog } from "../components/dialogs/RelationshipChangeDialog";
import { TreeSidebar } from "../components/layout/TreeSidebar";
import { FamilyQuickLinks } from "../components/animata/fabs/FamilyQuickLinks";
import { useFamilyTree } from "../hooks/useFamilyTree";
import { useTreePersistence } from "../hooks/useTreePersistence";
import { getChildCounts } from "../lib/tree-logic";
import { computeTreeLayout, type TreeNodeMode } from "../lib/tree-layout";
import { exportTree, parseTreeBackup } from "../lib/tree-backup";
import { getFullName, getNameParts } from "../lib/member-name";
import type { FamilyMember, RelationshipKind } from "../types/family";
import { isAppTheme, type AppTheme } from "../types/theme";
import { useLanguage } from "../i18n/useLanguage";
import { getLayoutDirection, layoutDirection } from "../config/layout";

type AddRequest = {
  targetId: string;
  kind: RelationshipKind;
  initialLastName?: string;
  initialFatherId?: string;
  initialMotherId?: string;
};
type AddMemory = { lastName: string; fatherId: string; motherId: string; targetId: string; kind: RelationshipKind };
type DropRequest = { source: FamilyMember; target: FamilyMember };
type RestoreRequest = { members: FamilyMember[]; fileName: string };

const DEBUG_EMPTY_STATE = false;
const EMPTY_MEMBERS: FamilyMember[] = [];

type DashboardPageProps = {
  treeId: string
  initialMembers: FamilyMember[]
  userEmail: string
  onSignOut: () => void
}

export function DashboardPage({ treeId, initialMembers, userEmail, onSignOut }: DashboardPageProps) {
  const { t, language } = useLanguage();
  const tree = useFamilyTree(DEBUG_EMPTY_STATE ? EMPTY_MEMBERS : initialMembers);
  const members = tree.members;
  const { undo, redo } = tree;
  const persistence = useTreePersistence(treeId, members, !DEBUG_EMPTY_STATE);
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem("family-tree-theme");
      if (isAppTheme(saved)) return saved;
      if (saved === "light") return "warm-light";
      if (saved === "charcoal" || saved === "slate") return "midnight";
      return "midnight";
    } catch {
      return "midnight";
    }
  });
  const [nodeMode, setNodeMode] = useState<TreeNodeMode>("circle");
  const [focusMode, setFocusMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [collapsedAncestorIds, setCollapsedAncestorIds] = useState<Set<string>>(
    new Set(),
  );
  const [zoom, setZoom] = useState(1);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const [addRequest, setAddRequest] = useState<AddRequest | null>(null);
  const addMemory = useRef<AddMemory | null>(null);
  const [pendingDrop, setPendingDrop] = useState<DropRequest | null>(null);
  const [deletePending, setDeletePending] = useState<FamilyMember | null>(null);
  const [editPending, setEditPending] = useState<FamilyMember | null>(null);
  const [restorePending, setRestorePending] = useState<RestoreRequest | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const selectedMember =
    members.find((member) => member.id === selectedId) ?? null;
  const layout = useMemo(() => computeTreeLayout(members), [members]);
  const surnameCount = useMemo(() => new Set(members
    .map((member) => getNameParts(member).lastName.trim().normalize("NFKD").toLocaleLowerCase())
    .filter(Boolean)).size, [members]);
  const branchIds = useMemo(
    () =>
      new Set(
        [...getChildCounts(members)]
          .filter(([, count]) => count > 0)
          .map(([id]) => id),
      ),
    [members],
  );

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          pendingDrop ||
          deletePending ||
          restorePending
        ) {
          event.preventDefault();
          setPendingDrop(null);
          setDeletePending(null);
          setRestorePending(null);
          return;
        }
        if (selectedId) {
          event.preventDefault();
          setSelectedId(null);
        }
        return;
      }
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addRequest,
    deletePending,
    editPending,
    pendingDrop,
    redo,
    restorePending,
    selectedId,
    undo,
  ]);
  useEffect(() => {
    try {
      localStorage.setItem("family-tree-theme", theme);
    } catch {
      /* Theme remains usable when storage is unavailable. */
    }
  }, [theme]);
  function openAdd(
    targetId = selectedId ?? members[0]?.id ?? "",
    kind: RelationshipKind = "child",
    source: "toolbar" | "relative" = "relative",
  ) {
    if (source === "toolbar") {
      const remembered = addMemory.current;
      setAddRequest({
        targetId: remembered?.targetId && members.some((member) => member.id === remembered.targetId)
          ? remembered.targetId
          : targetId,
        kind: remembered?.kind ?? kind,
        ...(remembered ? {
          initialLastName: remembered.lastName,
          initialFatherId: remembered.fatherId,
          initialMotherId: remembered.motherId,
        } : {}),
      });
      return;
    }
    const target = members.find((member) => member.id === targetId);
    const contextualLastName = target && (kind === "child" || kind === "sibling")
      ? getNameParts(target).lastName
      : undefined;
    setAddRequest({ targetId, kind, initialLastName: contextualLastName });
  }
  function findMember(member: FamilyMember) {
    setCollapsedIds(new Set());
    setCollapsedAncestorIds(new Set());
    setSelectedId(member.id);
    setFocusMode(false);
    setZoom((current) => Math.min(1.15, Math.max(current, 1)));
    setNavigationTarget((current) => ({
      id: member.id,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  }
  function fitTree() {
    const size = computeTreeLayout(members, nodeMode);
    const viewport = document.querySelector(".tree-viewport");
    const availableWidth = viewport?.clientWidth ?? window.innerWidth - 320;
    const availableHeight = viewport?.clientHeight ?? window.innerHeight - 230;
    setZoom(
      Math.max(
        0.25,
        Math.min(
          1.4,
          availableWidth / size.width,
          availableHeight / size.height,
        ),
      ),
    );
  }
  function autoOrganize() {
    setCollapsedIds(new Set());
    setCollapsedAncestorIds(new Set());
    setFocusMode(false);
    fitTree();
    setLayoutRevision((revision) => revision + 1);
  }
  function toggleBranch(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAncestors(id: string) {
    setCollapsedAncestorIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function downloadTree(branchOnly: boolean) {
    const content = exportTree(members, branchOnly ? selectedId : null);
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = branchOnly
      ? "family-tree-branch.json"
      : "family-tree-backup.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(
      t(
        branchOnly ? "Selected branch exported." : "Full tree backup exported.",
      ),
    );
  }
  async function restoreTree(file: File) {
    try {
      const restored = parseTreeBackup(JSON.parse(await file.text()));
      if (!restored)
        throw new Error(t("This file is not a valid family tree backup."));
      setRestorePending({ members: restored, fileName: file.name });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : t("Could not restore this backup."),
      );
    }
  }
  function confirmRelationship(kind: RelationshipKind) {
    if (!pendingDrop) return;
    tree.updateRelationship(pendingDrop.source.id, pendingDrop.target.id, kind);
    setSelectedId(pendingDrop.source.id);
    setStatus("Family relationship updated.");
    setPendingDrop(null);
  }
  function confirmDelete() {
    if (!deletePending) return;
    tree.deleteMember(deletePending.id);
    setSelectedId(null);
    setDeletePending(null);
  }
  function confirmRestore() {
    if (!restorePending) return;
    tree.restore(restorePending.members);
    setCollapsedIds(new Set());
    setSelectedId(null);
    setRestorePending(null);
    setStatus(t("Family tree backup restored."));
  }

  return (
    <main
      className="tree-app"
      data-theme={theme}
      data-layout-direction={layoutDirection}
      lang={language}
      dir={getLayoutDirection(language)}
    >
      <TreeSidebar
        theme={theme}
        onSetTheme={setTheme}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />
      <section className="tree-main">
        <TreeToolbar
          members={members}
          zoom={zoom}
          mode={nodeMode}
          selectedId={selectedId}
          areAllExpanded={
            collapsedIds.size === 0 && collapsedAncestorIds.size === 0
          }
          canUndo={tree.canUndo}
          canRedo={tree.canRedo}
          onAddPerson={() => openAdd(undefined, "child", "toolbar")}
          onAutoOrganize={autoOrganize}
          onSearch={findMember}
          onZoom={(amount) =>
            setZoom((current) =>
              Math.min(
                1.5,
                Math.max(0.35, Math.round((current + amount) * 10) / 10),
              ),
            )
          }
          onFit={fitTree}
          onExpandAll={() => {
            setCollapsedIds(new Set());
            setCollapsedAncestorIds(new Set());
          }}
          onCollapseAll={() => setCollapsedIds(new Set(branchIds))}
          onUndo={tree.undo}
          onRedo={tree.redo}
          onSetMode={(mode) => setNodeMode(mode)}
          onExport={downloadTree}
          onImport={(file) => void restoreTree(file)}
        />
        <div className="tree-workspace">
          <div className="canvas-heading">
            <div>
              <div className="canvas-title-row">
                <h2>{t("Family tree")}</h2>
                <span className={`tree-save-status tree-save-status-${persistence.status}`} role="status" aria-live="polite">
                  {t(persistence.status === "saving" ? "Saving…" : persistence.status === "error" ? "Could not save changes." : "Saved")}
                  {persistence.status === "error" && <button type="button" onClick={persistence.retry}>{t("Try again")}</button>}
                </span>
              </div>
              <span className="generation-badge quick-stats-pill" aria-label={t("Family tree statistics")}>
                <span><bdi>{members.length}</bdi> {t("stats people")}</span>
                <i aria-hidden="true" />
                <span><bdi>{new Set([...layout.positions.values()].map((point) => point.generation)).size}</bdi> {t("stats generations")}</span>
                <i aria-hidden="true" />
                <span><bdi>{surnameCount}</bdi> {t("stats surnames")}</span>
              </span>
            </div>
          </div>
          <div className="canvas-stage">
            <FamilyTreeCanvas
              members={members}
              collapsedIds={collapsedIds}
              collapsedAncestorIds={collapsedAncestorIds}
              zoom={zoom}
              selectedId={selectedId}
              focusId={focusMode ? selectedId : null}
              mode={nodeMode}
              layoutRevision={layoutRevision}
              navigationTarget={navigationTarget}
              onSelect={(member) => {
                setSelectedId((current) =>
                  current === member.id ? null : member.id,
                );
                setFocusMode(false);
              }}
              onToggleBranch={toggleBranch}
              onToggleAncestors={toggleAncestors}
              onAddRelative={(member, kind) => openAdd(member.id, kind)}
              onProposeRelationship={(source, target) =>
                setPendingDrop({ source, target })
              }
              onEmptyAdd={() => openAdd("", "child")}
              onEditPerson={(member) => { setSelectedId(member.id); setEditPending(member) }}
              onDeletePerson={(member) => { setSelectedId(member.id); setDeletePending(member) }}
              onCenterPerson={findMember}
              onFocusMember={findMember}
              onLinkRelative={(memberId, relativeId, kind) => {
                tree.updateRelationship(memberId, relativeId, kind);
                setStatus("Family relationship updated.");
              }}
            />
          </div>
          <div className="status-message" aria-live="polite" key={status}>{status}</div>
          <div className="canvas-footer" aria-label={t("Keyboard shortcuts")}>
            <span className="canvas-shortcuts">
              <span className="shortcut-item">
                <bdi className="shortcut-keys" dir="ltr">
                  <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                </bdi>
                <span>{t("Undo")}</span>
              </span>
              <span className="footer-separator" aria-hidden="true" />
              <span className="shortcut-item">
                <bdi className="shortcut-keys" dir="ltr">
                  <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
                </bdi>
                <span>{t("Redo")}</span>
              </span>
            </span>
          </div>
          {selectedMember && (
            <MemberDetailsPanel
              member={selectedMember}
              members={members}
              onClose={() => setSelectedId(null)}
              onAddRelative={openAdd}
              onLinkRelative={(memberId, relativeId, kind) => {
                tree.updateRelationship(memberId, relativeId, kind);
                setStatus("Family relationship updated.");
              }}
              onSelectRelative={findMember}
              onUpdateProfile={tree.updateProfile}
              onEdit={() => setEditPending(selectedMember)}
              onDelete={() => setDeletePending(selectedMember)}
            />
          )}
        </div>
      </section>
      {addRequest && (
        <AddFamilyMemberDialog
          isOpen
          members={members}
          initialTargetId={addRequest.targetId}
          initialKind={addRequest.kind}
          initialLastName={addRequest.initialLastName}
          initialFatherId={addRequest.initialFatherId}
          initialMotherId={addRequest.initialMotherId}
          onClose={() => setAddRequest(null)}
          onAdd={(
            targetId,
            kind,
            firstName,
            lastName,
            gender,
            birthDate,
            photo,
            avatar,
            fatherId,
            motherId,
            deathDate,
            lifeStatus,
          ) => {
            const previousMemory = addMemory.current;
            const hasParentContext = kind === "child" || kind === "sibling";
            addMemory.current = {
              lastName,
              fatherId: hasParentContext ? fatherId ?? "" : previousMemory?.fatherId ?? "",
              motherId: hasParentContext ? motherId ?? "" : previousMemory?.motherId ?? "",
              targetId: hasParentContext ? targetId : previousMemory?.targetId ?? targetId,
              kind: hasParentContext ? kind : previousMemory?.kind ?? "child",
            };
            tree.addRelated(
              targetId,
              kind,
              firstName,
              lastName,
              gender,
              birthDate,
              photo,
              avatar,
              fatherId,
              motherId,
              deathDate,
              lifeStatus,
            );
          }}
          onSelectExisting={findMember}
        />
      )}
      {editPending && (
        <EditPersonDialog
          key={editPending.id}
          member={editPending}
          members={members}
          onClose={() => setEditPending(null)}
          onSave={tree.updateDetails}
        />
      )}
      {pendingDrop && (
        <RelationshipChangeDialog
          source={pendingDrop.source}
          target={pendingDrop.target}
          members={members}
          onCancel={() => setPendingDrop(null)}
          onConfirm={confirmRelationship}
        />
      )}
      {deletePending && (
        <ConfirmationDialog
          danger
          title={
            <>
              {t("Delete {name}?").split("{name}")[0]}
              <PersonName name={getFullName(deletePending)} />
              {t("Delete {name}?").split("{name}")[1]}
            </>
          }
          message={
            deletePending.gender === "male"
              ? "This also removes his links."
              : deletePending.gender === "female"
                ? "This also removes her links."
                : "This also removes their links."
          }
          confirmLabel="Delete"
          onCancel={() => setDeletePending(null)}
          onConfirm={confirmDelete}
        />
      )}
      {restorePending && (
        <ConfirmationDialog
          title={t("Restore this family tree?")}
          message={t(
            "The selected backup contains {count} people and will replace the current tree. You can undo the restore afterward.",
            { count: restorePending.members.length },
          )}
          confirmLabel="Restore backup"
          onCancel={() => setRestorePending(null)}
          onConfirm={confirmRestore}
        />
      )}
      <FamilyQuickLinks />
    </main>
  );
}
