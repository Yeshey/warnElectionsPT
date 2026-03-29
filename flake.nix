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
          f nixpkgs.legacyPackages.${system}
      );
  in {
    devShells = eachSystem (pkgs: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_25
          android-tools
          jdk17
          eas-cli
        ];

        shellHook = ''
          echo "Env ready"
        '';

        #ANDROID_HOME = "${pkgs.android-tools}/share/android-tools";
        #JAVA_HOME = "${pkgs.jdk17}";
      };
    });
  };
}