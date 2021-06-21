import * as path from 'path';
import {
  generateSARIFFromCommand,
  ROOT_DIR,
  verifySARIFPaths,
} from './helpers';
import { startMockServer } from '../iac/helpers';

jest.setTimeout(50000);

describe('GitHub action', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  describe('IaC', () => {
    describe.each([
      [
        'iac',
        [
          {
            relativeDir: '',
            inputPath: './iac', // one folder down
          },
          {
            relativeDir: 'iac',
            inputPath: '.', // current directory provided as .
          },
          {
            relativeDir: 'iac',
            inputPath: '', // current directory provided by default
          },
          {
            relativeDir: 'iac/file-output',
            inputPath: '../../iac', // one folder up
          },
        ],
        ['', '--legacy'],
      ],
    ])('when running %p command', (command, configs, flags) => {
      for (const config of configs) {
        const relativeDir = config.relativeDir;
        const inputPath = path.join(config.inputPath);
        const inputDir = path.resolve(
          path.join(ROOT_DIR, relativeDir),
          inputPath,
        );

        describe(`when changing directory into ${relativeDir} and providing input path ${inputPath}`, () => {
          for (const flag of flags) {
            it(`when running with flag ${flag}`, async () => {
              const sarif = await generateSARIFFromCommand(
                run,
                command,
                relativeDir,
                inputPath,
                flag,
              );

              verifySARIFPaths(sarif, inputDir);
            });
          }
        });
      }
    });
  });
});
