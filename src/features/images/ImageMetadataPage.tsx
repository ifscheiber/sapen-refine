import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilLineIcon } from "lucide-react";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ImageMetadataClient } from "./ImageMetadataClient";

export async function ImageMetadataPage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      projectId: true,
      filename: true,
      contentType: true,
      size: true,
      width: true,
      height: true,
      sampleMetadata: { select: { tNumber: true } },
    },
  });

  if (!image || image.projectId !== projectId) {
    notFound();
  }
  const editability = evaluateTrialImageEditability(image.width, image.height);

  return (
    <AppMain>
      <AppPageHeader
        title={image.filename ?? image.id}
        description={`${image.sampleMetadata?.tNumber ? `T-number: ${image.sampleMetadata.tNumber}` : "T-number missing"} · Role: ${membership.role}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images`}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Images
              </Link>
            </Button>
            {editability.status === "unsupported" ? (
              <Button disabled title="Trial editor supports images up to 8000 x 6000 pixels.">
                <PencilLineIcon className="size-4" aria-hidden="true" />
                Open editor
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/app/projects/${projectId}/images/${image.id}/edit`}>
                  <PencilLineIcon className="size-4" aria-hidden="true" />
                  Open editor
                </Link>
              </Button>
            )}
          </>
        }
      />
      <ImageMetadataClient imageId={image.id} />
    </AppMain>
  );
}
