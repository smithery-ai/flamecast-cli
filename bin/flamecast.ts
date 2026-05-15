#!/usr/bin/env bun
import { dispatch } from "../src/commands.ts"

const code = await dispatch(process.argv.slice(2))
process.exit(code)
