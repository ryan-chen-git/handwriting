// Minimal subset of @ol-types/compile used by the vendored pdf-preview feature.
export type PDFFile = {
  url: string;
  size: number;
  name?: string;
  createdAt?: Date;
};

export type CompileResponseData = {
  status?: string;
  outputFiles?: Array<{
    url?: string;
    path: string;
    type: string;
    build?: string;
    size?: number;
  }>;
  clsiServerId?: string;
  compileGroup?: string;
  pdfDownloadDomain?: string;
  pdfCachingMinChunkSize: number;
  timings?: {
    compileE2E?: number;
    pdfDownload?: number;
    pdfStream?: number;
  };
};
