import { createHash } from "crypto";
import { build, transform } from "esbuild";
import { readFile } from "fs/promises";
import { basename, extname } from "path";
import { pathToFileURL } from "url";
import type {
  FunctionDeclaration,
  ExportNamedDeclaration,
  Program,
} from "estree";
import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import * as astring from "astring";

let cwdUrl = pathToFileURL(`${process.cwd()}/`);

export async function buildAll() {
  let clientComponents = new Set<ClientComponent>();
  let serverActions = new Set<ServerAction>();

  // build RSCs
  let rscBuild = await build({
    bundle: true,
    format: "esm",
    jsx: "automatic",
    logLevel: "error",
    entryPoints: [
      "./app/**/*.page.tsx",
      "./app/layout.tsx",
      "./app/global.css",
    ],
    outdir: "./.learn-rsc/apps/rsc/",
    entryNames: "[dir]/[name]",
    conditions: ["react-server", "module"],
    packages: "external",
    platform: "node",
    splitting: true,
    chunkNames: "chunks/[name]",
    metafile: true,
    plugins: [
      {
        name: "client-components",
        setup(build) {
          build.onLoad({ filter: /\.(ts|tsx|js|jsx)$/ }, async ({ path }) => {
            let contents = await readFile(path, "utf-8");
            let isClient = contents.startsWith('"use client";\n');

            if (isClient) {
              let md5 = createHash("md5").update(path).digest("hex");
              let name = basename(path, extname(path));
              let moduleId = `${name}-${md5}`;

              clientComponents.add({
                moduleId,
                path,
              });

              return {
                loader: "js",
                contents: `
                  import { createClientModuleProxy } from "react-server-dom-webpack/server.edge";
                  export default createClientModuleProxy("${moduleId}#default");
                `,
              };
            }
          });
        },
      },
      {
        name: "server-actions",
        setup(build) {
          build.onLoad({ filter: /\.(ts|tsx|js|jsx)$/ }, async ({ path }) => {
            let contents = await readFile(path, "utf-8");
            let hasAction = contents.includes('"use server";\n');

            if (hasAction) {
              let md5 = createHash("md5").update(path).digest("hex");
              let name = basename(path, extname(path));
              let moduleId = `${name}-${md5}`;

              let { code } = await transform(contents, {
                loader: extname(path) in [".ts", ".tsx"] ? "tsx" : "jsx",
                jsx: "automatic",
                format: "esm",
              });

              let state: ModuleState = {
                actions: [],
                exports: [],
              };

              let ast = acorn.parse(code, {
                ecmaVersion: "latest",
                sourceType: "module",
              });

              acornWalk.ancestor(ast, {
                FunctionDeclaration(_node, _, ancestors) {
                  let node = _node as unknown as FunctionDeclaration;
                  if (
                    node.body.type === "BlockStatement" &&
                    node.body.body[0]
                  ) {
                    let firstStatement = node.body.body[0];
                    if (
                      firstStatement.type === "ExpressionStatement" &&
                      firstStatement.expression.type === "Literal" &&
                      firstStatement.expression.value === "use server"
                    ) {
                      state.actions.push(node);
                    }
                  }
                },
                ExportNamedDeclaration(node) {
                  state.exports.push(node as unknown as ExportNamedDeclaration);
                },
              });

              for (let node of state.actions) {
                let index = (ast as unknown as Program).body.indexOf(node);
                let name = node.id?.name;

                if (!name) {
                  throw new Error(`No name found for action in file: ${path}`);
                }

                let id = `${moduleId}#${name}`;

                let referenceCode = `
                ${name}.$$typeof = Symbol.for("react.server.reference");
                ${name}.$$id = "${id}";
                ${name}.$$bound = null;
                `;

                serverActions.add({
                  moduleId,
                  path,
                  export: name,
                });

                let tree = acorn.parse(referenceCode, {
                  ecmaVersion: "latest",
                });

                for (let exportNode of state.exports) {
                  let specifiers = exportNode.specifiers;

                  let isExported = specifiers.some((specifier) => {
                    return (
                      specifier.exported.name === name &&
                      specifier.local.name === name
                    );
                  });

                  if (!isExported) {
                    exportNode.specifiers.push({
                      type: "ExportSpecifier",
                      local: { type: "Identifier", name: name },
                      exported: { type: "Identifier", name: name },
                    });
                  }
                }

                ast.body.splice(index + 1, 0, ...tree.body);
              }

              return {
                contents: astring.generate(ast),
                loader: "js",
              };
            }
          });
        },
      },
    ],
  });

  let rscOutputs = rscBuild.metafile.outputs;
  let rscOutputFiles = Object.keys(rscOutputs);
  let serverActionMap = new Map<string, CompiledAction>();

  for (let serverAction of serverActions) {
    let outputFile = rscOutputFiles.find((file) => {
      let inputs = rscOutputs[file].inputs;
      let inputFiles = Object.keys(inputs);
      let wasUsed = inputFiles.some((input) =>
        serverAction.path.endsWith(input),
      );
      return wasUsed;
    });

    if (outputFile) {
      let id = `${serverAction.moduleId}#${serverAction.export}`;
      serverActionMap.set(id, {
        id,
        export: serverAction.export,
        path: new URL(`./${outputFile}`, cwdUrl).pathname,
      });
    }
  }

  let clientBuild = await build({
    bundle: true,
    format: "esm",
    jsx: "automatic",
    logLevel: "error",
    entryPoints: [
      "./bundler/client-app/initialize.tsx",
      ...Array.from(clientComponents).map((component) => component.path),
    ],
    entryNames: "entries/[name]",
    outdir: "./.learn-rsc/apps/client-app/",
    outbase: "./",
    splitting: true,
    chunkNames: "chunks/[name]-[hash]",
    metafile: true,
    plugins: [],
  });

  let clientComponentMap = new Map<
    string,
    {
      id: string;
      chunks: string[];
      name: string;
      async: false;
    }
  >();

  let clientComponentsUrl = new URL("./.learn-rsc/apps/client-app/", cwdUrl);
  let clientOutputBase = clientComponentsUrl.href.slice(cwdUrl.href.length);
  let clientOutputs = clientBuild.metafile.outputs;
  let clientOutputFiles = Object.keys(clientOutputs);

  for (let clientComponent of clientComponents) {
    let outputFile = clientOutputFiles.find((file) => {
      let inputs = clientOutputs[file].inputs;
      let inputFiles = Object.keys(inputs);
      let wasUsed = inputFiles.some((input) =>
        clientComponent.path.endsWith(input),
      );
      return wasUsed;
    });

    if (outputFile) {
      let id = `${clientComponent.moduleId}#default`;
      let file = outputFile.slice(clientOutputBase.length);
      let chunk = `${id}:${file}`;

      clientComponentMap.set(id, {
        id,
        chunks: [chunk],
        // we only support default exports
        name: "default",
        async: false,
      });
    }
  }

  return {
    clientComponentMap: Object.fromEntries(clientComponentMap),
    serverActionMap: Object.fromEntries(serverActionMap),
  };
}

type ClientComponent = {
  moduleId: string;
  path: string;
};

type ModuleState = {
  actions: FunctionDeclaration[];
  exports: ExportNamedDeclaration[];
};

type ServerAction = {
  moduleId: string;
  path: string;
  export: string;
};

type CompiledAction = {
  id: string;
  path: string;
  export: string;
};
