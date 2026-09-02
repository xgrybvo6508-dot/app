import { useCallback, useState } from 'react';
import { listNodes, type ListNodesFilter } from '../db/nodes';
import type { GraphNode } from '../db/types';

export function useNodeList(filter: ListNodesFilter) {
  const [nodes, setNodes] = useState<GraphNode[]>(() => listNodes(filter));

  const refresh = useCallback(() => {
    setNodes(listNodes(filter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)]);

  return { nodes, refresh };
}
