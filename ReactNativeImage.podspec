require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeImage"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/Obitrain/obi-image.git", :tag => "#{s.version}" }
  s.swift_versions = ['5.0']

  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
    "cpp/**/*.{hpp,cpp}",
  ]

  s.pod_target_xcconfig = {
    "CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES" => "YES",
    "SWIFT_INCLUDE_PATHS" => "$(inherited) $(PODS_TARGET_SRCROOT)/ios",
  }

  s.dependency 'Kingfisher', '~> 8.12'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  load 'nitrogen/generated/ios/ReactNativeImage+autolinking.rb'
  add_nitrogen_files(s)

  # nitrogen 0.36 emits Bool(fromCxx: shared_ptr), rejected by Swift 6.2 (Xcode 26); same fix as react-native-healthkit.
  s.script_phase = {
    :name => '[ReactNativeImage] Fix Swift 6.2 CxxConvertibleToBool',
    :script => "perl -i -pe 's/Bool\\(fromCxx: cachedCxxPart\\)/cachedCxxPart.use_count() > 0/g' \"${PODS_TARGET_SRCROOT}/nitrogen/generated/ios/swift/\"*Spec_cxx.swift 2>/dev/null || true",
    :execution_position => :before_compile,
  }

  install_modules_dependencies(s)
end
