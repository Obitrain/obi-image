const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withProjectBuildGradle(config, (mod) => {
    const anchor = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const dependency =
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0')";
    if (
      !mod.modResults.contents.includes(anchor) &&
      !mod.modResults.contents.includes(dependency)
    ) {
      throw new Error(
        'Unsupported Expo Gradle template: Kotlin classpath missing'
      );
    }
    // Expo's root classloader must use the same compiler as the image library.
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      dependency
    );
    return mod;
  });
