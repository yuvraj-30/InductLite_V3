import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

function stub(pathname: string): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  return path.resolve(thisDir, pathname);
}

export default defineConfig({
  resolve: {
    alias: {
      "react-native": stub("./test/stubs/react-native.ts"),
      "expo-application": stub("./test/stubs/expo-application.ts"),
      "expo-device": stub("./test/stubs/expo-device.ts"),
      "expo-constants": stub("./test/stubs/expo-constants.ts"),
      "expo-task-manager": stub("./test/stubs/expo-task-manager.ts"),
      "expo-location": stub("./test/stubs/expo-location.ts"),
      "@react-native-async-storage/async-storage": stub(
        "./test/stubs/async-storage.ts",
      ),
      "expo-secure-store": stub("./test/stubs/expo-secure-store.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "**/*.d.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
