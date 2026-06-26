{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs = { systems, nixpkgs, ... } @ inputs:
  let
    eachSystem = f:
      nixpkgs.lib.genAttrs (import systems) (
        system:
          let
            pkgs = import nixpkgs {
              inherit system;
              config.allowUnfree = true;
              config.android_sdk.accept_license = true;
            };
          in
            f pkgs
      );
  in {
    devShells = eachSystem (pkgs: let
      androidSdk = (pkgs.androidenv.composeAndroidPackages {
        buildToolsVersions = [ "35.0.0" "36.0.0" ];
        platformVersions = [ "35" "36" ];
        abiVersions = [ "arm64-v8a" "armeabi-v7a" ];
        includeNDK = true;
        ndkVersions = [ "27.1.12297006" ];
        cmakeVersions = [ "3.22.1" ];
        includeEmulator = false;
        includeSystemImages = false;
      }).androidsdk;
      sdkRoot = "${androidSdk}/libexec/android-sdk";
    in {
      default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_25
          jdk17
          eas-cli
          androidSdk
          gradle
        ];

        shellHook = ''
          echo "Env ready"
          # Write local.properties so Gradle finds the SDK without trying to download anything
          echo "sdk.dir=${sdkRoot}" > android/local.properties
          # Symlink ndk-bundle to the versioned path Gradle expects
          mkdir -p ${sdkRoot}/ndk
          if [ ! -e "${sdkRoot}/ndk/27.1.12297006" ]; then
            ln -sf ${sdkRoot}/ndk-bundle ${sdkRoot}/ndk/27.1.12297006 2>/dev/null || true
          fi
        '';

        ANDROID_HOME = sdkRoot;
        ANDROID_SDK_ROOT = sdkRoot;
        JAVA_HOME = "${pkgs.jdk17}";
      };
    });
  };
}