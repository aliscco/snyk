import { readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import * as path from 'path';
const osName = require('os-name');
import { v4 as uuidv4 } from 'uuid';

export async function generateSARIFFromCommand(
  run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
  command: string,
  relativeDir: string,
  inputPath: string,
  flag: string,
): Promise<string> {
  const sarifOutputFilename = path.join(__dirname, `${uuidv4()}.sarif`);

  // Before running the command, check if we need to change into a different directory
  const changeDir =
    relativeDir !== '' ? `cd ${isWindows ? '/d' : ''} ${relativeDir} &&` : '';
  const { stderr } = await run(
    `${changeDir} snyk ${command} test ${inputPath} ${flag} --sarif-file-output=${sarifOutputFilename}`,
  );
  expect(stderr).toBe('');

  const outputFileContents = readFileSync(sarifOutputFilename, 'utf-8');
  unlinkSync(sarifOutputFilename);

  return outputFileContents;
}

export async function verifySARIFPaths(sarif: string, inputDir: string) {
  const jsonObj = JSON.parse(sarif);

  const actualPaths: Set<string> = new Set();
  for await (const p of walk(inputDir)) {
    actualPaths.add('file://' + p.replace(/\\/g, '/')); // URIs should use forward slash, not backward slash
  }

  const generatedPaths: Set<string> = new Set();
  for (const run of jsonObj.runs) {
    const projectRoot = run.originalUriBaseIds.PROJECTROOT.uri;

    for (const result of run.results) {
      for (const loc of result.locations) {
        generatedPaths.add(
          projectRoot + loc.physicalLocation.artifactLocation.uri,
        );
      }
    }
  }

  for (const p of generatedPaths) {
    expect(actualPaths).toContainEqual(p);
  }
}

async function* walk(dir: string) {
  const files = readdirSync(dir);
  for (const file of files) {
    const entry = path.join(dir, file);
    if (statSync(entry).isDirectory()) {
      yield* walk(entry);
    } else {
      yield entry;
    }
  }
}

const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

export const ROOT_DIR = './test/fixtures';
