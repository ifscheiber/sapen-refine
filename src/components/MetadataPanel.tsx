import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ImageMetadata {
  imageId: string;
  projectReference: string;
  annotator: string;
  status: "not_annotated" | "in_progress" | "annotated" | "reviewed";
  lastModified: string;
  notes: string;
  treatmentId?: string;
  woodSpecies?: string;
  experimentId?: string;
}

interface MetadataPanelProps {
  metadata: ImageMetadata;
  onMetadataChange: (metadata: ImageMetadata) => void;
}

export function MetadataPanel({
  metadata,
  onMetadataChange,
}: MetadataPanelProps) {
  const updateField = <K extends keyof ImageMetadata>(
    field: K,
    value: ImageMetadata[K]
  ) => {
    onMetadataChange({ ...metadata, [field]: value });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Image Metadata */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Image Metadata
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Image ID
                </Label>
                <Input
                  value={metadata.imageId}
                  disabled
                  className="bg-gray-100 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Project Reference
                </Label>
                <Input
                  value={metadata.projectReference}
                  onChange={(e) =>
                    updateField("projectReference", e.target.value)
                  }
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Annotator
                </Label>
                <Input
                  value={metadata.annotator}
                  disabled
                  className="bg-gray-100 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Annotation Status
                </Label>
                <Select
                  value={metadata.status}
                  onValueChange={(value) =>
                    updateField(
                      "status",
                      value as ImageMetadata["status"]
                    )
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_annotated">
                      Not annotated
                    </SelectItem>
                    <SelectItem value="in_progress">
                      In progress
                    </SelectItem>
                    <SelectItem value="annotated">Annotated</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Last Modified
                </Label>
                <Input
                  value={metadata.lastModified}
                  disabled
                  className="bg-gray-100 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Free Text Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Annotation Notes
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Document assumptions, uncertainties, or special cases
            </p>
            <Textarea
              value={metadata.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add notes about this annotation..."
              className="min-h-32 text-sm"
            />
          </div>

          {/* Optional Structured Metadata */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Structured Metadata
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Treatment ID
                </Label>
                <Input
                  value={metadata.treatmentId || ""}
                  onChange={(e) => updateField("treatmentId", e.target.value)}
                  placeholder="Optional"
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Wood Species
                </Label>
                <Input
                  value={metadata.woodSpecies || ""}
                  onChange={(e) => updateField("woodSpecies", e.target.value)}
                  placeholder="Optional"
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1.5 block">
                  Experiment ID
                </Label>
                <Input
                  value={metadata.experimentId || ""}
                  onChange={(e) =>
                    updateField("experimentId", e.target.value)
                  }
                  placeholder="Optional"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
