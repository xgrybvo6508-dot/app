import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../lib/theme';
import type { CytoscapeElement } from '../lib/graph/cytoscapeElements';

// v1 canvas per the plan: "WebView + Cytoscape.js — быстрее для v1, чем нативный
// gesture-canvas" (Финальные архитектурные решения). Regenerates the whole page
// on every data change — pan/zoom position resets on edit, acceptable for v1.
function buildHtml(elements: CytoscapeElement[], focusId: string | null): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
<style>
  html, body, #cy { margin: 0; padding: 0; width: 100%; height: 100%; background: ${colors.graphBackground}; }
</style>
</head>
<body>
<div id="cy"></div>
<script>
  const elements = ${JSON.stringify(elements)};
  const focusId = ${JSON.stringify(focusId)};

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: 'data(label)',
          'font-size': 10,
          color: '${colors.textPrimary}',
          'text-wrap': 'wrap',
          'text-max-width': '80px',
          width: 36,
          height: 36,
          'text-valign': 'bottom',
          'text-margin-y': 4,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': '${colors.graphEdge}',
          'target-arrow-color': '${colors.graphEdge}',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'font-size': 8,
          label: 'data(label)',
          color: '${colors.graphEdgeLabel}',
        },
      },
      {
        selector: '.dimmed',
        style: { opacity: 0.15 },
      },
    ],
    layout: { name: 'cose', animate: false },
  });

  if (focusId) {
    const root = cy.getElementById(focusId);
    const keep = root.closedNeighborhood();
    cy.elements().difference(keep).addClass('dimmed');
  }

  cy.on('tap', 'node', (evt) => {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nodeTap', id: evt.target.id() }));
  });
</script>
</body>
</html>`;
}

export interface GraphCanvasProps {
  elements: CytoscapeElement[];
  focusId?: string | null;
  onNodeTap?: (id: string) => void;
}

export function GraphCanvas({ elements, focusId = null, onNodeTap }: GraphCanvasProps) {
  const html = useMemo(() => buildHtml(elements, focusId), [elements, focusId]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type: string; id: string };
      if (payload.type === 'nodeTap') {
        onNodeTap?.(payload.id);
      }
    } catch {
      // ignore malformed messages from the canvas page
    }
  }

  return (
    <View style={styles.container}>
      <WebView source={{ html }} onMessage={handleMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
