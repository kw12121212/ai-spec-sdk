class AiSpecSdk < Formula
  desc "Polyglot JSON-RPC bridge for Claude Agent SDK"
  homepage "https://github.com/ai-spec/ai-spec-sdk"
  version "0.2.0"

  on_macos do
    on_arm do
      url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-cli-macos-arm64"
      sha256 "REPLACE_ME"
      
      resource "bridge" do
        url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-spec-bridge-macos-arm64"
        sha256 "REPLACE_ME"
      end
    end
    on_intel do
      url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-cli-macos-x64"
      sha256 "REPLACE_ME"

      resource "bridge" do
        url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-spec-bridge-macos-x64"
        sha256 "REPLACE_ME"
      end
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-cli-linux-arm64"
      sha256 "REPLACE_ME"

      resource "bridge" do
        url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-spec-bridge-linux-arm64"
        sha256 "REPLACE_ME"
      end
    end
    on_intel do
      url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-cli-linux-x64"
      sha256 "REPLACE_ME"

      resource "bridge" do
        url "https://github.com/ai-spec/ai-spec-sdk/releases/download/v0.2.0/ai-spec-bridge-linux-x64"
        sha256 "REPLACE_ME"
      end
    end
  end

  def install
    bin.install "ai-cli-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}" => "ai-cli"
    
    resource("bridge").stage do
      bin.install "ai-spec-bridge-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}" => "ai-spec-bridge"
    end
  end

  test do
    system "#{bin}/ai-cli", "--help"
  end
end
