"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { statusColor, statusLabel } from "@/lib/pipeline";
import { BuildListingForm } from "./BuildListingForm";
import type { PropertyData, RLAData, AreaData, DetailsData } from "./BuildListingForm";

interface PendingImport {
  id: string;
  tally_submission_id: string | null;
  property_name_text: string | null;
  created_at: string;
  surveyor: string;
  date: string;
}

interface Props {
  property: PropertyData & { status: string };
  rla: RLAData | null;
  area: AreaData | null;
  details: DetailsData | null;
  pendingImports: PendingImport[];
  onLinkImport: (pendingId: string) => Promise<void>;
}

// ── Unsaved Changes Modal ──────────────────────────────────────────────────

function UnsavedModal({
  onSaveAndLeave,
  onLeave,
  onCancel,
  isSaving,
}: {
  onSaveAndLeave: () => void;
  onLeave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-600">warning</span>
          </div>
          <div>
            <h2 className="font-bold text-[#0d2137] text-lg">Unsaved changes</h2>
            <p className="text-sm text-[#6e7a74]">You have changes that haven&apos;t been saved yet.</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onSaveAndLeave}
            disabled={isSaving}
            className="w-full py-3 bg-[#1a7a5e] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Saving…</>
            ) : (
              <><span className="material-symbols-outlined text-lg">save</span> Save &amp; Leave</>
            )}
          </button>
          <button
            onClick={onLeave}
            disabled={isSaving}
            className="w-full py-3 border border-red-200 text-red-600 bg-red-50 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50"
          >
            Leave without saving
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="w-full py-3 text-[#6e7a74] hover:text-[#1b1c1c] text-sm"
          >
            Cancel — stay on page
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page client wrapper ────────────────────────────────────────────────────

export function BuildListingPageClient({
  property,
  rla,
  area,
  details,
  pendingImports,
  onLinkImport,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saveBeforeLeave, setSaveBeforeLeave] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isLinking, startLinkTransition] = useTransition();

  // Browser close / refresh guard
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // After save completes while "Save & Leave" was chosen, navigate
  useEffect(() => {
    if (saveBeforeLeave && !isDirty && pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
      setSaveBeforeLeave(false);
    }
  }, [isDirty, saveBeforeLeave, pendingHref, router]);

  function guardedNavigate(href: string) {
    if (isDirty) {
      setPendingHref(href);
    } else {
      router.push(href);
    }
  }

  function handleSaveAndLeave() {
    setSaveBeforeLeave(true);
    formRef.current?.requestSubmit();
  }

  function handleLeaveWithoutSaving() {
    setIsDirty(false);
    const target = pendingHref!;
    setPendingHref(null);
    router.push(target);
  }

  function handleCancelModal() {
    setPendingHref(null);
    setSaveBeforeLeave(false);
  }

  const listingsHref = "/admin/listings";

  return (
    <>
      {/* Unsaved changes modal */}
      {pendingHref && (
        <UnsavedModal
          onSaveAndLeave={handleSaveAndLeave}
          onLeave={handleLeaveWithoutSaving}
          onCancel={handleCancelModal}
          isSaving={isSaving}
        />
      )}

      {/* Header breadcrumb — guarded */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-[#3e4944] mb-2">
          <button onClick={() => guardedNavigate(listingsHref)} className="hover:text-[#1a7a5e]">
            Listings
          </button>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-[#1b1c1c] font-medium">Build Listing</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(property.status)}`}>
            {statusLabel(property.status)}
          </span>
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">edit</span>
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: main form */}
        <div className="lg:col-span-2">
          <BuildListingForm
            property={property}
            rla={rla}
            area={area}
            details={details}
            formRef={formRef}
            onDirty={() => setIsDirty(true)}
            onClean={() => setIsDirty(false)}
          />
        </div>

        {/* Right: Tally import + tips */}
        <div className="space-y-4 sticky top-8">
          <div className="bg-[#0d2137] text-white rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#9cf4d1]">bolt</span>
              <h3 className="font-bold">Import from Tally</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              If the surveyor submitted the Tally form, import it here. RLA scores, area overview, and notes will populate automatically.
            </p>

            {pendingImports.length === 0 ? (
              <div className="bg-white/5 rounded-lg p-4 text-sm text-white/50 text-center">
                No pending Tally submissions.
                <br />
                <span className="text-xs">They appear here after the surveyor submits the form.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingImports.map((item) => (
                  <div key={item.id} className="bg-white/10 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-xs text-white/50">Property typed by surveyor</p>
                      <p className="text-sm font-semibold text-white">&ldquo;{item.property_name_text}&rdquo;</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                      <span>Surveyor: <strong className="text-white/80">{item.surveyor}</strong></span>
                      <span>Date: <strong className="text-white/80">{item.date}</strong></span>
                    </div>
                    <button
                      disabled={isLinking}
                      onClick={() => {
                        startLinkTransition(async () => {
                          await onLinkImport(item.id);
                          router.refresh();
                        });
                      }}
                      className="w-full py-2 bg-[#9cf4d1] text-[#0d2137] rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1"
                    >
                      {isLinking ? (
                        <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Importing…</>
                      ) : (
                        "Link & Import This Submission"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => guardedNavigate("/admin/surveys/pending")}
                className="text-xs text-[#9cf4d1] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Manage all pending imports
              </button>
            </div>
          </div>

          {/* Build checklist */}
          <div className="bg-white rounded-xl border border-[#cccccc] p-5 space-y-3 text-sm text-[#3e4944]">
            <p className="font-semibold text-[#0d2137] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1a7a5e] text-base">info</span>
              Build checklist
            </p>
            {[
              "Fill all 8 RLA scores",
              "Add ≥2 pros and ≥2 cons",
              "Complete area overview",
              "List key facilities",
              "Save → status becomes Draft",
              "Then upload photos (≥15)",
              "Approve → Publish as Live",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#1a7a5e] font-bold text-xs mt-0.5">{i + 1}.</span>
                <span className="text-xs">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
