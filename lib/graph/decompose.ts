// The shared "разбиение на составляющие" primitive from the plan — reused by
// Идеи (module 2), сложный материал в Обучении (module 7), and Ресерч (module 8)
// claim breakdown. Not a separate feature per module: one function, three callers.
import { createNode, type CreateNodeInput } from '../db/nodes';
import { createEdge } from '../db/edges';
import type { EdgeType, GraphNode, NodeType } from '../db/types';

export interface DecomposeInput {
  parentId: string;
  parentType: NodeType;
  /** Edge type linking each new sub-node back to the parent (part_of for hierarchy,
   *  supports/contradicts for claim decomposition in research). */
  linkType: EdgeType;
  subNodes: Array<Pick<CreateNodeInput, 'title' | 'body' | 'attributes'> & { type?: NodeType }>;
}

export interface DecomposeResult {
  subNodes: GraphNode[];
}

export function decomposeNode(input: DecomposeInput): DecomposeResult {
  const subNodes = input.subNodes.map((sub) => {
    const node = createNode({
      type: sub.type ?? input.parentType,
      title: sub.title,
      body: sub.body,
      attributes: sub.attributes,
    });
    createEdge({ fromId: node.id, toId: input.parentId, type: input.linkType });
    return node;
  });

  return { subNodes };
}
