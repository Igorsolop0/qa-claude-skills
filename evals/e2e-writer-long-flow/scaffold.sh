#!/bin/bash
# Copies the generated BugBoard project (no node_modules) into the empty workspace.
set -euo pipefail
cp -R "$(cd "$(dirname "$0")" && pwd)/project/." .
