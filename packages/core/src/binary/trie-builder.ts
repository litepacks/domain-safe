interface TrieNode {
  terminal: boolean;
  children: Map<string, TrieNode>;
}

function createNode(): TrieNode {
  return { terminal: false, children: new Map() };
}

export function insertDomain(root: TrieNode, domain: string): void {
  const labels = domain.split(".").reverse();
  let node = root;
  for (const label of labels) {
    let child = node.children.get(label);
    if (!child) {
      child = createNode();
      node.children.set(label, child);
    }
    node = child;
  }
  node.terminal = true;
}

export interface SerializedTrie {
  trie: Uint8Array;
  stringPool: Uint8Array;
}

export function serializeTrie(root: TrieNode): SerializedTrie {
  const stringChunks: string[] = [];
  const stringOffsets = new Map<string, number>();

  function intern(label: string): number {
    let offset = stringOffsets.get(label);
    if (offset !== undefined) return offset;
    offset = stringChunks.reduce((acc, s) => acc + s.length, 0);
    stringOffsets.set(label, offset);
    stringChunks.push(label);
    return offset;
  }

  const nodeEntries: Array<{
    terminal: boolean;
    children: Array<{ label: string; labelOffset: number; labelLen: number; childIndex: number }>;
  }> = [];

  function assignIndex(node: TrieNode): number {
    const index = nodeEntries.length;
    nodeEntries.push({ terminal: false, children: [] });

    const children: Array<{
      label: string;
      labelOffset: number;
      labelLen: number;
      childIndex: number;
    }> = [];

    for (const [label, child] of node.children) {
      children.push({
        label,
        labelOffset: intern(label),
        labelLen: label.length,
        childIndex: assignIndex(child),
      });
    }

    children.sort((a, b) => a.label.localeCompare(b.label));
    nodeEntries[index] = { terminal: node.terminal, children };
    return index;
  }

  assignIndex(root);

  // Compute node byte sizes and offsets
  const nodeOffsets: number[] = [];
  let trieSize = 0;
  for (const entry of nodeEntries) {
    nodeOffsets.push(trieSize);
    trieSize += 5 + entry.children.length * 9; // flags(1) + count(4) + children(9 each)
  }

  const trie = new Uint8Array(trieSize);
  const view = new DataView(trie.buffer);

  for (let i = 0; i < nodeEntries.length; i++) {
    const entry = nodeEntries[i]!;
    const offset = nodeOffsets[i]!;
    view.setUint8(offset, entry.terminal ? 1 : 0);
    view.setUint32(offset + 1, entry.children.length, true);
    let childOff = offset + 5;
    for (const child of entry.children) {
      view.setUint32(childOff, child.labelOffset, true);
      view.setUint8(childOff + 4, child.labelLen);
      view.setUint32(childOff + 5, nodeOffsets[child.childIndex]!, true);
      childOff += 9;
    }
  }

  const poolStr = stringChunks.join("");
  const stringPool = new TextEncoder().encode(poolStr);

  return { trie, stringPool };
}

export function buildTrieFromDomains(domains: string[]): SerializedTrie {
  const root = createNode();
  for (const domain of domains) {
    insertDomain(root, domain);
  }
  return serializeTrie(root);
}
