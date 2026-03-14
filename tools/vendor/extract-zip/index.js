const debug = require("debug")("extract-zip");
const { createWriteStream, promises: fs } = require("fs");
const getStream = require("get-stream");
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const yauzl = require("yauzl");

const openZip = promisify(yauzl.open);
const pipeline = promisify(stream.pipeline);

class Extractor {
  constructor(zipPath, opts) {
    this.zipPath = zipPath;
    this.opts = opts;
  }

  async extract() {
    debug("opening", this.zipPath, "with opts", this.opts);

    this.zipfile = await openZip(this.zipPath, { lazyEntries: true });
    this.canceled = false;

    return new Promise((resolve, reject) => {
      this.zipfile.on("error", (error) => {
        this.canceled = true;
        reject(error);
      });
      this.zipfile.readEntry();

      this.zipfile.on("close", () => {
        if (!this.canceled) {
          debug("zip extraction complete");
          resolve();
        }
      });

      this.zipfile.on("entry", async (entry) => {
        if (this.canceled) {
          debug("skipping entry", entry.fileName, { cancelled: this.canceled });
          return;
        }

        debug("zipfile entry", entry.fileName);

        if (entry.fileName.startsWith("__MACOSX/")) {
          this.zipfile.readEntry();
          return;
        }

        const destDir = path.dirname(path.join(this.opts.dir, entry.fileName));

        try {
          await fs.mkdir(destDir, { recursive: true });

          const canonicalDestDir = await fs.realpath(destDir);
          const relativeDestDir = path.relative(this.opts.dir, canonicalDestDir);

          if (relativeDestDir.split(path.sep).includes("..")) {
            throw new Error(
              `Out of bound path "${canonicalDestDir}" found while processing file ${entry.fileName}`,
            );
          }

          await this.extractEntry(entry);
          debug("finished processing", entry.fileName);
          this.zipfile.readEntry();
        } catch (error) {
          this.canceled = true;
          this.zipfile.close();
          reject(error);
        }
      });
    });
  }

  async extractEntry(entry) {
    if (this.canceled) {
      debug("skipping entry extraction", entry.fileName, {
        cancelled: this.canceled,
      });
      return;
    }

    if (this.opts.onEntry) {
      this.opts.onEntry(entry, this.zipfile);
    }

    const dest = path.join(this.opts.dir, entry.fileName);

    const mode = (entry.externalFileAttributes >> 16) & 0xffff;
    const ifmt = 61440;
    const ifdir = 16384;
    const iflnk = 40960;
    const symlink = (mode & ifmt) === iflnk;
    let isDir = (mode & ifmt) === ifdir;

    if (!isDir && entry.fileName.endsWith("/")) {
      isDir = true;
    }

    const madeBy = entry.versionMadeBy >> 8;
    if (!isDir) {
      isDir = madeBy === 0 && entry.externalFileAttributes === 16;
    }

    debug("extracting entry", {
      filename: entry.fileName,
      isDir,
      isSymlink: symlink,
    });

    const procMode = this.getExtractedMode(mode, isDir) & 0o777;
    const destDir = isDir ? dest : path.dirname(dest);

    const mkdirOptions = { recursive: true };
    if (isDir) {
      mkdirOptions.mode = procMode;
    }
    debug("mkdir", { dir: destDir, ...mkdirOptions });
    await fs.mkdir(destDir, mkdirOptions);
    if (isDir) return;

    debug("opening read stream", dest);
    const readStream = await promisify(
      this.zipfile.openReadStream.bind(this.zipfile),
    )(entry);

    if (symlink) {
      const link = await getStream(readStream);
      debug("creating symlink", link, dest);
      await fs.symlink(link, dest);
    } else {
      await pipeline(readStream, createWriteStream(dest, { mode: procMode }));
    }
  }

  getExtractedMode(entryMode, isDir) {
    let mode = entryMode;
    if (mode === 0) {
      if (isDir) {
        if (this.opts.defaultDirMode) {
          mode = parseInt(this.opts.defaultDirMode, 10);
        }

        if (!mode) {
          mode = 0o755;
        }
      } else {
        if (this.opts.defaultFileMode) {
          mode = parseInt(this.opts.defaultFileMode, 10);
        }

        if (!mode) {
          mode = 0o644;
        }
      }
    }

    return mode;
  }
}

module.exports = async function extractZip(zipPath, opts) {
  debug("creating target directory", opts.dir);

  if (!path.isAbsolute(opts.dir)) {
    throw new Error("Target directory is expected to be absolute");
  }

  await fs.mkdir(opts.dir, { recursive: true });
  opts.dir = await fs.realpath(opts.dir);
  return new Extractor(zipPath, opts).extract();
};
