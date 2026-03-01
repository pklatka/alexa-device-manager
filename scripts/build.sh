#!/bin/bash

# Build script for Alexa Device Manager extension
# Copies only the necessary files into a clean build/ directory

set -e

# Project root (one level up from scripts/)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
ZIP_FILE="$ROOT_DIR/build.zip"

# Clean previous build
rm -rf "$BUILD_DIR" "$ZIP_FILE"
mkdir -p "$BUILD_DIR/src" "$BUILD_DIR/icons"

echo "Building Alexa Device Manager..."

# Copy manifest
cp "$ROOT_DIR/manifest.json" "$BUILD_DIR/"

# Copy source files
cp "$ROOT_DIR/src/popup.html" "$BUILD_DIR/src/"
cp "$ROOT_DIR/src/popup.css" "$BUILD_DIR/src/"
cp "$ROOT_DIR/src/popup.js"  "$BUILD_DIR/src/"
cp "$ROOT_DIR/src/content.js" "$BUILD_DIR/src/"

# Copy icons referenced in manifest.json and popup.html
cp "$ROOT_DIR/icons/icon16.png"  "$BUILD_DIR/icons/"
cp "$ROOT_DIR/icons/icon48.png"  "$BUILD_DIR/icons/"
cp "$ROOT_DIR/icons/icon128.png" "$BUILD_DIR/icons/"
cp "$ROOT_DIR/icons/icon.png"    "$BUILD_DIR/icons/"
cp "$ROOT_DIR/icons/bin.svg"     "$BUILD_DIR/icons/"
cp "$ROOT_DIR/icons/refresh.svg" "$BUILD_DIR/icons/"

# Compress the directory into a zip file
zip -r "$ZIP_FILE" "$BUILD_DIR"

echo "Build complete → $BUILD_DIR"
