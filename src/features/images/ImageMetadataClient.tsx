"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SaveIcon } from "lucide-react";

import { AppSection } from "@/components/shell/AppSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MetadataStatus =
  | "complete"
  | "incomplete"
  | "optional-missing"
  | "not-validated"
  | "failed-validation";

type MetadataCompletenessItem = {
  key: string;
  label: string;
  status: MetadataStatus;
  requiredFor: "annotation" | "training-export" | "optional";
  message: string;
};

type MetadataBundle = {
  image: {
    id: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
    checksum: string | null;
    width: number | null;
    height: number | null;
    validationStatus: "PENDING" | "VALIDATED" | "FAILED";
    uploadedAt: string;
    uploadedBy: { email: string; name: string | null } | null;
    acquisitionMetadata: AcquisitionMetadata | null;
    sampleMetadata: SampleMetadata | null;
  };
  myRole: string;
  canEditMetadata: boolean;
  completeness: {
    overall: MetadataStatus;
    items: MetadataCompletenessItem[];
  };
};

type AcquisitionMetadata = {
  cameraDevice: string | null;
  lensObjective: string | null;
  exposure: string | null;
  aperture: string | null;
  iso: string | null;
  whiteBalance: string | null;
  colorProfile: string | null;
  lightingSetup: string | null;
  capturedBy: string | null;
  capturedAt: string | null;
  notes: string | null;
};

type SampleMetadata = {
  tNumber: string | null;
  specimenIdentifier: string | null;
  sliceIndex: number | null;
  replicate: string | null;
  treatmentReference: string | null;
  notes: string | null;
};

type MetadataFormState = {
  acquisition: Record<keyof AcquisitionMetadata, string>;
  sample: Record<keyof SampleMetadata, string>;
};

const ACQUISITION_EMPTY: Record<keyof AcquisitionMetadata, string> = {
  cameraDevice: "",
  lensObjective: "",
  exposure: "",
  aperture: "",
  iso: "",
  whiteBalance: "",
  colorProfile: "",
  lightingSetup: "",
  capturedBy: "",
  capturedAt: "",
  notes: "",
};

const SAMPLE_EMPTY: Record<keyof SampleMetadata, string> = {
  tNumber: "",
  specimenIdentifier: "",
  sliceIndex: "",
  replicate: "",
  treatmentReference: "",
  notes: "",
};

function formatBytes(size: number | null) {
  if (!size) return "Missing";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Missing";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Missing";
  return date.toLocaleString();
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromBundle(bundle: MetadataBundle): MetadataFormState {
  const acquisition = bundle.image.acquisitionMetadata;
  const sample = bundle.image.sampleMetadata;

  return {
    acquisition: {
      ...ACQUISITION_EMPTY,
      cameraDevice: acquisition?.cameraDevice ?? "",
      lensObjective: acquisition?.lensObjective ?? "",
      exposure: acquisition?.exposure ?? "",
      aperture: acquisition?.aperture ?? "",
      iso: acquisition?.iso ?? "",
      whiteBalance: acquisition?.whiteBalance ?? "",
      colorProfile: acquisition?.colorProfile ?? "",
      lightingSetup: acquisition?.lightingSetup ?? "",
      capturedBy: acquisition?.capturedBy ?? "",
      capturedAt: toDateTimeLocal(acquisition?.capturedAt),
      notes: acquisition?.notes ?? "",
    },
    sample: {
      ...SAMPLE_EMPTY,
      tNumber: sample?.tNumber ?? "",
      specimenIdentifier: sample?.specimenIdentifier ?? "",
      sliceIndex: sample?.sliceIndex === null || sample?.sliceIndex === undefined ? "" : String(sample.sliceIndex),
      replicate: sample?.replicate ?? "",
      treatmentReference: sample?.treatmentReference ?? "",
      notes: sample?.notes ?? "",
    },
  };
}

function errorMessage(error: unknown, fallback = "SAVE_FAILED") {
  return error instanceof Error ? error.message : fallback;
}

function statusClass(status: MetadataStatus) {
  if (status === "failed-validation") return "border-destructive text-destructive";
  if (status === "incomplete" || status === "not-validated") return "border-destructive text-foreground";
  return "border-border text-muted-foreground";
}

function statusLabel(status: MetadataStatus) {
  return status.replace("-", " ");
}

function TechnicalValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm">{value}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  disabled,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Textarea
        value={value}
        disabled={disabled}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ImageMetadataClient({ imageId }: { imageId: string }) {
  const [bundle, setBundle] = useState<MetadataBundle | null>(null);
  const [form, setForm] = useState<MetadataFormState>({
    acquisition: ACQUISITION_EMPTY,
    sample: SAMPLE_EMPTY,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/images/${imageId}/metadata`, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setError(data?.error ?? `LOAD_FAILED_${res.status}`);
      setLoading(false);
      return;
    }

    const nextBundle = data as MetadataBundle;
    setBundle(nextBundle);
    setForm(fromBundle(nextBundle));
    setLoading(false);
  }, [imageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = Boolean(bundle?.canEditMetadata) && !saving;

  const technicalRows = useMemo(() => {
    if (!bundle) return [];
    const image = bundle.image;
    return [
      ["Filename", image.filename ?? "Missing"],
      ["Content type", image.contentType ?? "Missing"],
      ["Size", formatBytes(image.size)],
      ["Checksum", image.checksum ?? "Missing"],
      ["Dimensions", image.width && image.height ? `${image.width} x ${image.height}` : "Missing"],
      ["Validation", image.validationStatus],
      ["Uploaded by", image.uploadedBy?.name ?? image.uploadedBy?.email ?? "Missing"],
      ["Uploaded at", formatDate(image.uploadedAt)],
    ] as const;
  }, [bundle]);

  function setAcquisitionField(field: keyof AcquisitionMetadata, value: string) {
    setForm((current) => ({
      ...current,
      acquisition: { ...current.acquisition, [field]: value },
    }));
  }

  function setSampleField(field: keyof SampleMetadata, value: string) {
    setForm((current) => ({
      ...current,
      sample: { ...current.sample, [field]: value },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const capturedAt = form.acquisition.capturedAt
        ? new Date(form.acquisition.capturedAt).toISOString()
        : null;
      const res = await fetch(`/api/images/${imageId}/metadata`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acquisition: {
            ...form.acquisition,
            capturedAt,
          },
          sample: {
            ...form.sample,
            sliceIndex: form.sample.sliceIndex,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `SAVE_FAILED_${res.status}`);

      const nextBundle = data as MetadataBundle;
      setBundle(nextBundle);
      setForm(fromBundle(nextBundle));
      setStatus("Metadata saved");
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !bundle) {
    return <AppSection className="text-sm text-muted-foreground">Loading metadata...</AppSection>;
  }

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive">{error}</div>}
      {status && <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">{status}</div>}

      {bundle && (
        <>
          <AppSection className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">Readiness</h2>
              <span className={`w-fit rounded-md border px-2 py-1 text-xs ${statusClass(bundle.completeness.overall)}`}>
                {statusLabel(bundle.completeness.overall)}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {bundle.completeness.items.map((item) => (
                <div key={item.key} className={`rounded-md border px-3 py-2 ${statusClass(item.status)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs">{item.requiredFor}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.message}</div>
                </div>
              ))}
            </div>
          </AppSection>

          <AppSection className="space-y-3">
            <h2 className="text-base font-semibold">Technical Metadata</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {technicalRows.map(([label, value]) => (
                <TechnicalValue key={label} label={label} value={value} />
              ))}
            </div>
          </AppSection>

          <AppSection className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">Sample Metadata</h2>
              <span className="text-xs text-muted-foreground">Image-level default</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="T-number"
                value={form.sample.tNumber}
                disabled={!canEdit}
                onChange={(value) => setSampleField("tNumber", value)}
              />
              <TextField
                label="Specimen identifier"
                value={form.sample.specimenIdentifier}
                disabled={!canEdit}
                onChange={(value) => setSampleField("specimenIdentifier", value)}
              />
              <TextField
                label="Slice index"
                type="number"
                value={form.sample.sliceIndex}
                disabled={!canEdit}
                onChange={(value) => setSampleField("sliceIndex", value)}
              />
              <TextField
                label="Replicate"
                value={form.sample.replicate}
                disabled={!canEdit}
                onChange={(value) => setSampleField("replicate", value)}
              />
              <TextField
                label="Treatment/reference"
                value={form.sample.treatmentReference}
                disabled={!canEdit}
                onChange={(value) => setSampleField("treatmentReference", value)}
              />
              <TextAreaField
                label="Sample notes"
                value={form.sample.notes}
                disabled={!canEdit}
                onChange={(value) => setSampleField("notes", value)}
              />
            </div>
          </AppSection>

          <AppSection className="space-y-4">
            <h2 className="text-base font-semibold">Acquisition Metadata</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Camera/device"
                value={form.acquisition.cameraDevice}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("cameraDevice", value)}
              />
              <TextField
                label="Lens/objective"
                value={form.acquisition.lensObjective}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("lensObjective", value)}
              />
              <TextField
                label="Exposure"
                value={form.acquisition.exposure}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("exposure", value)}
              />
              <TextField
                label="Aperture"
                value={form.acquisition.aperture}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("aperture", value)}
              />
              <TextField
                label="ISO"
                value={form.acquisition.iso}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("iso", value)}
              />
              <TextField
                label="White balance"
                value={form.acquisition.whiteBalance}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("whiteBalance", value)}
              />
              <TextField
                label="Color profile"
                value={form.acquisition.colorProfile}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("colorProfile", value)}
              />
              <TextField
                label="Lighting setup"
                value={form.acquisition.lightingSetup}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("lightingSetup", value)}
              />
              <TextField
                label="Captured by"
                value={form.acquisition.capturedBy}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("capturedBy", value)}
              />
              <TextField
                label="Captured at"
                type="datetime-local"
                value={form.acquisition.capturedAt}
                disabled={!canEdit}
                onChange={(value) => setAcquisitionField("capturedAt", value)}
              />
              <div className="md:col-span-2">
                <TextAreaField
                  label="Acquisition notes"
                  value={form.acquisition.notes}
                  disabled={!canEdit}
                  onChange={(value) => setAcquisitionField("notes", value)}
                />
              </div>
            </div>
          </AppSection>

          {bundle.canEditMetadata && (
            <div className="sticky bottom-0 z-10 border-t border-border bg-background py-3">
              <Button onClick={save} disabled={saving}>
                <SaveIcon className="size-4" aria-hidden="true" />
                {saving ? "Saving..." : "Save metadata"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
