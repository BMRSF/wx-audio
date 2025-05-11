import fs from "fs";
import path from "path";
import archiver from "archiver";

export default function magiskPlugin(options = {}) {
  const { zipName = "magisk-module.zip" } = options;

  return {
    name: "vite-plugin-magisk",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve("dist"); // default Vite outDir
      const tmpDir = path.resolve(".module_tmp");
      const moduleFolder = path.resolve("module");
      const metaInfPath = path.join(
        tmpDir,
        "META-INF",
        "com",
        "google",
        "android"
      );
      const updateBinary = path.resolve(metaInfPath, "update-binary");
      const updateScript = path.resolve(metaInfPath, "update-script");

      const releasePath = path.resolve("release");
      const zipPath = path.resolve(releasePath, zipName);

      if (fs.existsSync(releasePath)) fs.rmSync(releasePath, { recursive: true });
      fs.mkdirSync(releasePath);

      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
      fs.mkdirSync(tmpDir);

      // Copy built files to tmpDir/system/...
      const webrootDir = path.join(tmpDir, "webroot");

      const pathsToCreate = [webrootDir, updateBinary, updateScript];

      for (const p of pathsToCreate) {
        const dir = path.dirname(p);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        console.log(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      copyRecursiveSync(outDir, webrootDir);

      copyRecursiveSync(moduleFolder, tmpDir);

      fs.writeFileSync(
        updateBinary,
        `#!/sbin/sh
umask 022
ui_print() { echo "$1"; }
require_new_magisk() {
  ui_print "*******************************"
  ui_print " Please install Magisk v20.4+! "
  ui_print "*******************************"
  exit 1
}
OUTFD=$2
ZIPFILE=$3
mount /data 2>/dev/null
if ! [ -f /data/adb/magisk/util_functions.sh ]; then
  require_new_magisk
fi
. /data/adb/magisk/util_functions.sh
if [ $MAGISK_VER_CODE -lt 20400 ]; then
  require_new_magisk
fi
install_module
exit 0\n`
      );
      fs.chmodSync(updateBinary, 0o755);

      fs.writeFileSync(updateScript, "#MAGISK");

      // Zip it
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        archive.on("error", reject);
        output.on("close", () => {
          fs.rmSync(tmpDir, { recursive: true });
          console.log(`Magisk module created: ${zipPath}`);
          resolve();
        });

        archive.pipe(output);
        archive.directory(tmpDir + "/", false);
        archive.finalize();
      });
    },
  };
}

// Recursive copy
function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
