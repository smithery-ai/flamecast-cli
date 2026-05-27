#!/usr/bin/env bun
import { BunRuntime } from "@effect/platform-bun"
import { run } from "../src/commands.ts"

run.pipe(BunRuntime.runMain)
