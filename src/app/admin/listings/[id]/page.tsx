import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePropertyDetails, deleteProperty } from "@/lib/actions/admin-actions";
import { PIPELINE_STAGES } from "@/lib/pipeline";

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select(`
      *,
      rla_assessments(*),
      property_details(*),
      owners(*),
      property_media(*),
      area_overviews(*),
      publish_checklist(*)
    `)
    .eq("id", id)
    .single();

  if (!property) notFound();

  const rla     = property.rla_assessments?.[0];
  const details = property.property_details?.[0];
  const media   = property.property_media?.[0];
  const area    = property.area_overviews?.[0];
  const owner   = property.owners as { name: string; email: string; phone_whatsapp: string } | null;

  // Compute checklist status from live data
  const rlaComplete =
    rla &&
    rla.building_condition  != null &&
    rla.natural_lighting    != null &&
    rla.ventilation         != null &&
    rla.noise_level         != null &&
    rla.cleanliness         != null &&
    rla.security_level      != null &&
    rla.bathroom_condition  != null &&
    rla.furniture_quality   != null &&
    Array.isArray(rla.pros) && (rla.pros as string[]).length >= 2 &&
    Array.isArray(rla.cons) && (rla.cons as string[]).length >= 2;

  const photosComplete = media && media.total_photo_count >= 15;
  const videoComplete  = !!(media?.video_url || property.property_surveys?.[0]?.video_walkthrough_url);
  const areaComplete   =
    area &&
    area.nearest_mrt         &&
    area.nearest_transjakarta &&
    area.nearest_minimarket   &&
    area.nearest_clinic       &&
    area.neighborhood_character &&
    area.expat_friendly != null;

  const checklist = [
    { label: "RLA completed (8 scores + 2+ pros/cons)",  done: !!rlaComplete },
    { label: "Photos uploaded (≥ 15)",                   done: !!photosComplete },
    { label: "Video walkthrough",                        done: !!videoComplete },
    { label: "Area overview filled",                     done: !!areaComplete },
    { label: "Price verified",                           done: !!(property.publish_checklist?.[0]?.price_verified) },
    { label: "Owner contact active",                     done: !!(property.publish_checklist?.[0]?.owner_contact_active) },
  ];

  async function handleUpdate(formData: FormData) {
    "use server";
    const result = await updatePropertyDetails(id, formData);
    if (!result.error) redirect("/admin/listings");
  }

  async function handleDelete() {
    "use server";
    await deleteProperty(id);
    redirect("/admin/listings");
  }

  const inputClass = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white";
  const labelClass = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-64 p-12 max-w-[1200px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#3e4944] mb-2">
              <Link href="/admin/listings" className="hover:text-[#1a7a5e]">Listings</Link>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-[#1b1c1c] font-medium">Edit</span>
            </div>
            <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/listings/${property.slug}`}
              target="_blank"
              className="px-4 py-2 border border-[#cccccc] text-[#3e4944] rounded-lg text-sm hover:bg-white"
            >
              View live →
            </Link>
            <form action={handleDelete}>
              <button
                type="submit"
                onClick={(e) => { if (!confirm("Delete this listing permanently?")) e.preventDefault(); }}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
              >
                Delete
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main edit form */}
          <form action={handleUpdate} className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-5">
              <h2 className="font-semibold text-[#0d2137]">Property Details</h2>

              <div>
                <label className={labelClass}>Name</label>
                <input name="name" defaultValue={property.name} required className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Area</label>
                  <select name="area" defaultValue={property.area ?? ""} className={inputClass}>
                    {["Kemang", "SCBD", "Senayan", "Sudirman", "Kuningan", "Menteng", "Other"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select name="property_type" defaultValue={property.property_type ?? ""} className={inputClass}>
                    <option value="apartment">Apartment</option>
                    <option value="kost">Kost</option>
                    <option value="house">House</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <input name="address" defaultValue={property.address ?? ""} className={inputClass} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Bedrooms</label>
                  <input name="bedrooms" type="number" min="0" defaultValue={property.bedrooms ?? 0} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Bathrooms</label>
                  <input name="bathrooms" type="number" min="1" defaultValue={property.bathrooms ?? 1} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Size (m²)</label>
                  <input name="size_sqm" type="number" defaultValue={property.size_sqm ?? ""} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Price / Month (IDR)</label>
                  <input name="price_monthly" type="number" required defaultValue={property.price_monthly ?? 0} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Min Stay (months)</label>
                  <input name="min_stay_months" type="number" min="1" defaultValue={property.min_stay_months ?? 1} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Pipeline Stage</label>
                <select name="status" defaultValue={property.status ?? "new_lead"} className={inputClass}>
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#1a7a5e] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md"
            >
              Save Changes
            </button>
          </form>

          {/* Side panels */}
          <div className="space-y-6">
            {/* Publish checklist */}
            <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-3">
              <h3 className="font-semibold text-[#0d2137] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a7a5e]">checklist</span>
                Publish Checklist
              </h3>
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span
                    className={`material-symbols-outlined text-base ${item.done ? "text-[#1a7a5e]" : "text-[#bec9c2]"}`}
                    style={{ fontVariationSettings: item.done ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.done ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className={item.done ? "text-[#1b1c1c]" : "text-[#6e7a74]"}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Owner info */}
            {owner && (
              <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-3">
                <h3 className="font-semibold text-[#0d2137] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1a7a5e]">person</span>
                  Owner
                </h3>
                <p className="font-medium text-sm text-[#1b1c1c]">{owner.name}</p>
                <p className="text-xs text-[#6e7a74]">{owner.email}</p>
                <p className="text-xs text-[#6e7a74]">{owner.phone_whatsapp}</p>
              </div>
            )}

            {/* RLA summary — 0-10 scale */}
            {rla && (
              <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-3">
                <h3 className="font-semibold text-[#0d2137] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1a7a5e]">verified_user</span>
                  RLA Score
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-[#1a7a5e]">{Number(rla.rla_score).toFixed(1)}</span>
                  <span className="text-[#6e7a74] text-sm">/ 10</span>
                </div>
                {[
                  { label: "Building",   val: rla.building_condition },
                  { label: "Lighting",   val: rla.natural_lighting },
                  { label: "Bathroom",   val: rla.bathroom_condition },
                  { label: "Ventilation",val: rla.ventilation },
                  { label: "Noise",      val: rla.noise_level },
                  { label: "Cleanliness",val: rla.cleanliness },
                  { label: "Security",   val: rla.security_level },
                  { label: "Furniture",  val: rla.furniture_quality },
                ].filter((i) => i.val != null).map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-[#3e4944] mb-1">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.val}/10</span>
                    </div>
                    <div className="w-full bg-[#e4e2e1] h-1.5 rounded-full">
                      <div className="bg-[#1a7a5e] h-full rounded-full" style={{ width: `${((item.val ?? 0) / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Photo count */}
            {media && (
              <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-2">
                <h3 className="font-semibold text-[#0d2137] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1a7a5e]">photo_library</span>
                  Photos
                </h3>
                <p className="text-sm text-[#3e4944]">
                  <span className={`font-bold ${media.total_photo_count >= 15 ? "text-[#1a7a5e]" : "text-amber-600"}`}>
                    {media.total_photo_count}
                  </span>
                  {" "}/ 15 minimum
                </p>
                {[
                  { label: "Exterior",    val: (media.photos_exterior    as string[])?.length ?? 0 },
                  { label: "Common area", val: (media.photos_common_area as string[])?.length ?? 0 },
                  { label: "Unit",        val: (media.photos_unit        as string[])?.length ?? 0 },
                  { label: "Bathroom",    val: (media.photos_bathroom    as string[])?.length ?? 0 },
                ].map((c) => (
                  <div key={c.label} className="flex justify-between text-xs text-[#6e7a74]">
                    <span>{c.label}</span>
                    <span>{c.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Facilities */}
            {details && (
              <div className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm space-y-2">
                <h3 className="font-semibold text-[#0d2137]">Facilities</h3>
                <div className="flex flex-wrap gap-1">
                  {((details.facilities as string[]) ?? []).map((f: string) => (
                    <span key={f} className="bg-[#e4e2e1] text-[#3e4944] px-2 py-1 rounded text-xs">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
