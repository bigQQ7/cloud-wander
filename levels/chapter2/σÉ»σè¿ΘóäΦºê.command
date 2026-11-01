#!/bin/zsh
cd "$(dirname "$0")"
open http://localhost:8765
/usr/bin/python3 serve.py
