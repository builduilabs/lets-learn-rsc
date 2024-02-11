const moduleMap = new Map<string, unknown>();

interface Window {
  __webpack_chunk_load__: (id: string) => Promise<any>;
  __webpack_require__: (id: string) => any;
}

window.__webpack_chunk_load__ = async function (chunkId) {
  let [module, remoteFile] = chunkId.split(":");
  let [moduleId, exportName] = module.split("#");
  let mod = await import(`/${remoteFile}`);
  moduleMap.set(moduleId, mod);
  return mod;
};

window.__webpack_require__ = function (id) {
  let [moduleId, exportName] = id.split("#");
  return moduleMap.get(moduleId);
};
