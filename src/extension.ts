// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const hoverProvider = vscode.languages.registerHoverProvider(
    ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    {
      provideHover(document, position): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(
          position,
          /@figma embed:[^ \n]+/
        );
        if (!range) {
          return;
        }
        const text = document.getText(range);
        const url = figmaEmbedUrlFromUri(text.replace(/^@figma /, ""));
        if (url) {
          const tooltip: vscode.MarkdownString =
            new vscode.MarkdownString().appendMarkdown(
              `[Figma Embed URL](${url})`
            );
          tooltip.isTrusted = true;
          return new vscode.Hover(
            tooltip,
            new vscode.Range(
              // nudging start forward "@figma " length
              range.start.with(range.start.line, range.start.character + 7),
              range.end
            )
          );
        }
      },
    }
  );

  context.subscriptions.push(hoverProvider);

  let panel: vscode.WebviewPanel | undefined = undefined;
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.figma-embed-preview", () =>
      figmaEmbedPreviewCommand(context, panel)
    )
  );
}

function figmaEmbedUrlFromUri(uri: string): string | null {
  const regex = /^embed:([A-Za-z0-9]+)(#(\d+:\d+))?$/;
  const match = uri.match(regex);
  if (!match) {
    return null;
  }
  const id = match?.[1];
  const nodeId = match?.[3];
  if (!id) {
    return null;
  }
  return [
    "https://www.figma.com/embed?embed_host=share&url=",
    encodeURIComponent(`https://www.figma.com/file/${id}`),
    nodeId ? encodeURIComponent(`?node-id=${nodeId}`) : "",
  ].join("");
}

function embedUrlFromUris(uriList: string[]): string | null {
  let url: string | null = null;

  uriList.forEach((uri) => {
    const embedUrl = figmaEmbedUrlFromUri(uri);
    if (!url && embedUrl) {
      url = embedUrl;
    }
  });
  return url;
}

async function figmaEmbedPreviewCommand(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel | undefined
) {
  const active = vscode.window.activeTextEditor;
  if (!active) {
    return;
  }
  const text = active.document.getText();
  const found: string[] = [];
  const regex = /@figma (embed:[^ \n]+)/g;
  let result;
  while ((result = regex.exec(text)) !== null) {
    found.push(result[1]);
  }
  const embedUrl = embedUrlFromUris(found);
  if (!embedUrl) {
    return;
  }

  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
  } else {
    panel = vscode.window.createWebviewPanel(
      "figmaEmbed",
      "Figma Embed",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    panel.onDidDispose(() => (panel = undefined), null, context.subscriptions);
  }
  panel.webview.html = assembleHTML(embedUrl);
}

function assembleHTML(embedUrl: string): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Figma Embed</title>
      <style>
        html, body {
          height: 100%;
          margin: 0;
        }
        iframe {
          border: none;
          height: 100%;
          width: 100%; 
        }
      </style>
    </head>
    <body>
      <iframe src="${embedUrl}" allowfullscreen></iframe>
    </body>
  </html>`;
}
