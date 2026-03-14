declare function extractZip(
  zipPath: string,
  opts: {
    dir: string;
    defaultDirMode?: number | string;
    defaultFileMode?: number | string;
    onEntry?: (entry: unknown, zipFile: unknown) => void;
  },
): Promise<void>;

export = extractZip;
