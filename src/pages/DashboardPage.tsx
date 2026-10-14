import { useEffect, useMemo, useState } from "react";
import { AddFamilyMemberDialog } from "../components/family-tree/AddFamilyMemberDialog";
import { FamilyMembersPanel } from "../components/family-tree/FamilyMembersPanel";
import { FamilyTreeCanvas } from "../components/family-tree/FamilyTreeCanvas";
import { MemberDetailsPanel } from "../components/family-tree/MemberDetailsPanel";
import { TreeToolbar } from "../components/family-tree/TreeToolbar";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { RelationshipChangeDialog } from "../components/dialogs/RelationshipChangeDialog";
import { TreeSidebar } from "../components/layout/TreeSidebar";
import { FamilyQuickLinks } from "../components/animata/fabs/FamilyQuickLinks";
import { useFamilyTree } from "../hooks/useFamilyTree";
import { getChildCounts } from "../lib/tree-logic";
import { computeTreeLayout, type TreeNodeMode } from "../lib/tree-layout";
import { exportTree, parseTreeBackup } from "../lib/tree-backup";
import type { FamilyMember, RelationshipKind } from "../types/family";
import { isAppTheme, type AppTheme } from "../types/theme";
import { useLanguage } from "../i18n/useLanguage";

type AddRequest = { targetId: string; kind: RelationshipKind };
type DropRequest = { source: FamilyMember; target: FamilyMember };
type RestoreRequest = { members: FamilyMember[]; fileName: string };

export function DashboardPage() {
  const { t, language } = useLanguage();
  const tree = useFamilyTree();
  const { undo, redo } = tree;
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem("family-tree-theme");
      if (isAppTheme(saved)) return saved;
      if (saved === "light") return "warm-light";
      if (saved === "charcoal") return "midnight";
      return "slate";
    } catch {
      return "slate";
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
  const [addRequest, setAddRequest] = useState<AddRequest | null>(null);
  const [pendingDrop, setPendingDrop] = useState<DropRequest | null>(null);
  const [deletePending, setDeletePending] = useState<FamilyMember | null>(null);
  const [restorePending, setRestorePending] = useState<RestoreRequest | null>(
    null,
  );
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [status, setStatus] = useState("");
  const selectedMember =
    tree.members.find((member) => member.id === selectedId) ?? null;
  const layout = useMemo(() => computeTreeLayout(tree.members), [tree.members]);
  const branchIds = useMemo(
    () =>
      new Set(
        [...getChildCounts(tree.members)]
          .filter(([, count]) => count > 0)
          .map(([id]) => id),
      ),
    [tree.members],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
      } else if (event.key === "Escape") {
        setAddRequest(null);
        setPendingDrop(null);
        setDeletePending(null);
        setRestorePending(null);
        setPeopleOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);
  useEffect(() => {
    try {
      localStorage.setItem("family-tree-theme", theme);
    } catch {
      /* Theme remains usable when storage is unavailable. */
    }
  }, [theme]);
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  function openAdd(
    targetId = selectedId ?? tree.members[0]?.id ?? "",
    kind: RelationshipKind = "child",
  ) {
    setAddRequest({ targetId, kind });
  }
  function findMember(member: FamilyMember) {
    setCollapsedIds(new Set());
    setCollapsedAncestorIds(new Set());
    setSelectedId(member.id);
    setFocusMode(false);
    setPeopleOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-member-id="${CSS.escape(member.id)}"]`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        }),
    );
  }
  function fitTree() {
    const size = computeTreeLayout(tree.members, nodeMode);
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
    const content = exportTree(tree.members, branchOnly ? selectedId : null);
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
    setStatus(t("Family relationship updated."));
    setPendingDrop(null);
  }
  function confirmDelete() {
    if (!deletePending) return;
    tree.deleteMember(deletePending.id);
    setSelectedId(null);
    setStatus(
      t("{name} was removed from the tree.", { name: deletePending.name }),
    );
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
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <TreeSidebar
        members={tree.members}
        theme={theme}
        onSetTheme={setTheme}
        onOpenPeople={() => setPeopleOpen(true)}
      />
      <section className="tree-main">
        <TreeToolbar
          members={tree.members}
          zoom={zoom}
          mode={nodeMode}
          selectedId={selectedId}
          areAllExpanded={collapsedIds.size === 0 && collapsedAncestorIds.size === 0}
          canUndo={tree.canUndo}
          canRedo={tree.canRedo}
          onAddPerson={() => openAdd()}
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
            setCollapsedIds(new Set())
            setCollapsedAncestorIds(new Set())
          }}
          onCollapseAll={() => setCollapsedIds(new Set(branchIds))}
          onUndo={tree.undo}
          onRedo={tree.redo}
          onSetMode={(mode) => setNodeMode(mode)}
          onExport={downloadTree}
          onImport={(file) => void restoreTree(file)}
        />
        <div className="canvas-heading">
          <div>
            <h2>{t("Family tree")}</h2>
            <span className="generation-badge">
              {tree.members.length} {t("people")} <i>·</i>{" "}
              {
                new Set(
                  [...layout.positions.values()].map(
                    (point) => point.generation,
                  ),
                ).size
              }{" "}
              {t("generations")}
            </span>
          </div>
          <p>
            {t(
              "Drag a person onto a relative to propose a relationship change. Confirm it before the tree updates.",
            )}
          </p>
        </div>
        <FamilyTreeCanvas
          members={tree.members}
          collapsedIds={collapsedIds}
          collapsedAncestorIds={collapsedAncestorIds}
          zoom={zoom}
          selectedId={selectedId}
          focusId={focusMode ? selectedId : null}
          mode={nodeMode}
          layoutRevision={layoutRevision}
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
        />
        <div className="canvas-footer">
          <span>
            <kbd>Ctrl</kbd>+<kbd>Z</kbd> {t("Undo")}{" "}
            <span className="footer-separator">·</span> <kbd>Ctrl</kbd>+
            <kbd>Shift</kbd>+<kbd>Z</kbd> {t("Redo")}
          </span>
        </div>
      </section>
      {selectedMember && (
        <MemberDetailsPanel
          member={selectedMember}
          members={tree.members}
          onClose={() => setSelectedId(null)}
          onAddRelative={openAdd}
          onLinkSpouse={(memberId, spouseId) =>
            tree.updateRelationship(memberId, spouseId, "partner")
          }
          onSelectRelative={findMember}
          onUpdateProfile={tree.updateProfile}
          onDelete={() => setDeletePending(selectedMember)}
        />
      )}
      {peopleOpen && (
        <FamilyMembersPanel
          members={tree.members}
          onSelect={findMember}
          onClose={() => setPeopleOpen(false)}
        />
      )}
      {addRequest && (
        <AddFamilyMemberDialog
          isOpen
          members={tree.members}
          initialTargetId={addRequest.targetId}
          initialKind={addRequest.kind}
          onClose={() => setAddRequest(null)}
          onAdd={(
            targetId,
            kind,
            name,
            gender,
            birthDate,
            photo,
            avatar,
            fatherId,
            motherId,
          ) => {
            tree.addRelated(
              targetId,
              kind,
              name,
              gender,
              birthDate,
              photo,
              avatar,
              fatherId,
              motherId,
            );
            setStatus(t("Family member added to the tree."));
          }}
          onSelectExisting={findMember}
        />
      )}
      {pendingDrop && (
        <RelationshipChangeDialog
          source={pendingDrop.source}
          target={pendingDrop.target}
          members={tree.members}
          onCancel={() => setPendingDrop(null)}
          onConfirm={confirmRelationship}
        />
      )}
      {deletePending && (
        <ConfirmationDialog
          danger
          title={t("Delete {name}?", { name: deletePending.name })}
          message="This removes this person and their relationship links from the tree. Other family members will stay in the tree."
          confirmLabel="Delete person"
          onCancel={() => setDeletePending(null)}
          onConfirm={confirmDelete}
        />
      )}
      {restorePending && (
        <ConfirmationDialog
          title="Restore this family tree?"
          message={t(
            "The selected backup contains {count} people and will replace the current tree. You can undo the restore afterward.",
            { count: restorePending.members.length },
          )}
          confirmLabel="Restore backup"
          onCancel={() => setRestorePending(null)}
          onConfirm={confirmRestore}
        />
      )}
      <div className="status-message" aria-live="polite" key={status}>
        {status}
      </div>
      <FamilyQuickLinks />
    </main>
  );
}
