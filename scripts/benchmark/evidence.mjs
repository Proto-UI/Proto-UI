import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export function safeFile(root, relative) {
  if (
    typeof relative !== 'string' ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Unsafe relative path: ${relative}`);
  const absoluteRoot = fs.realpathSync(root);
  const result = path.resolve(absoluteRoot, relative);
  let current = absoluteRoot;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(`Symlinks are not evidence inputs: ${relative}`);
  }
  if (!result.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('Path escapes root');
  return result;
}
export function writeNew(root, relative, content) {
  const target = safeFile(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { flag: 'wx' });
}
export function listFiles(root, relative = '') {
  const files = [];
  for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
    const rel = relative ? `${relative}/${name}` : name;
    const stat = fs.lstatSync(path.join(root, rel));
    if (stat.isSymbolicLink()) throw new Error(`Symlink in evidence: ${rel}`);
    if (stat.isDirectory()) files.push(...listFiles(root, rel));
    else if (stat.isFile()) files.push(rel);
    else throw new Error(`Unsupported evidence entry: ${rel}`);
  }
  return files;
}
export function sealEvidence(root) {
  if (fs.existsSync(path.join(root, 'inventory.json'))) throw new Error('Evidence already sealed');
  const artifacts = listFiles(root).map((file) => ({
    path: file,
    bytes: fs.statSync(path.join(root, file)).size,
    sha256: sha256(fs.readFileSync(path.join(root, file))),
  }));
  writeNew(
    root,
    'inventory.json',
    json({
      schemaVersion: 1,
      policy: 'write-once-by-runner; hash-verified; not externally immutable storage',
      artifacts,
    })
  );
  const inventoryDigest = sha256(fs.readFileSync(path.join(root, 'inventory.json')));
  writeNew(root, 'seal.json', json({ schemaVersion: 1, inventorySha256: inventoryDigest }));
  return inventoryDigest;
}
export function verifyEvidence(root) {
  const inventory = readJson(safeFile(root, 'inventory.json'));
  const seal = readJson(safeFile(root, 'seal.json'));
  if (sha256(fs.readFileSync(path.join(root, 'inventory.json'))) !== seal.inventorySha256)
    throw new Error('Inventory digest mismatch');
  const actual = listFiles(root).filter(
    (name) => name !== 'inventory.json' && name !== 'seal.json'
  );
  if (JSON.stringify(actual) !== JSON.stringify(inventory.artifacts.map((item) => item.path)))
    throw new Error('Evidence inventory differs (missing, extra, duplicate, or reordered files)');
  for (const item of inventory.artifacts) {
    const data = fs.readFileSync(safeFile(root, item.path));
    if (data.length !== item.bytes || sha256(data) !== item.sha256)
      throw new Error(`Evidence digest mismatch: ${item.path}`);
  }
  return { artifacts: actual.length, inventorySha256: seal.inventorySha256 };
}
