import { Check, Clock, Loader2 } from "lucide-react";
import assembleMindLogo from "@/assets/logo-assemblemind.png";

interface AppFooterProps {
  saveStatus: "idle" | "saving" | "saved";
  lastSaveTime: string | null;
  projectName: string;
  annotatedCount: number;
  totalCount: number;
}

export function AppFooter({
  saveStatus,
  lastSaveTime,
  projectName,
  annotatedCount,
  totalCount,
}: AppFooterProps) {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex items-center justify-between text-sm">
      {/* Left: Save Status */}
      <div className="flex items-center gap-3 text-gray-300 min-w-64">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Saving...</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="w-4 h-4 text-green-400" />
            <span>All changes saved</span>
          </>
        )}
        {saveStatus === "idle" && lastSaveTime && (
          <>
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">
              Last saved: {lastSaveTime}
            </span>
          </>
        )}
      </div>

      {/* Center: Project Info */}
      <div className="flex items-center gap-4 text-gray-300">
        <span className="font-medium">{projectName}</span>
        <span className="text-gray-400">•</span>
        <span>
          {annotatedCount} / {totalCount} annotated
        </span>
      </div>

      {/* Right: Logo */}
      <div className="min-w-64 flex items-center justify-end text-gray-400 text-xs">
        <img src={assembleMindLogo.src} alt="assembleMIND" className="h-5 w-auto" />
      </div>
    </footer>
  );
}
