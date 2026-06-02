"use strict";var W=Object.create;var C=Object.defineProperty;var j=Object.getOwnPropertyDescriptor;var G=Object.getOwnPropertyNames;var H=Object.getPrototypeOf,K=Object.prototype.hasOwnProperty;var J=(e,o)=>{for(var t in o)C(e,t,{get:o[t],enumerable:!0})},O=(e,o,t,n)=>{if(o&&typeof o=="object"||typeof o=="function")for(let m of G(o))!K.call(e,m)&&m!==t&&C(e,m,{get:()=>o[m],enumerable:!(n=j(o,m))||n.enumerable});return e};var p=(e,o,t)=>(t=e!=null?W(H(e)):{},O(o||!e||!e.__esModule?C(t,"default",{value:e,enumerable:!0}):t,e)),X=e=>O(C({},"__esModule",{value:!0}),e);var de={};J(de,{activate:()=>re,deactivate:()=>ce});module.exports=X(de);var x=p(require("vscode"));var d=p(require("vscode"));var l=p(require("vscode"));async function a(e){try{await l.commands.executeCommand("claude-vscode.primaryEditor.open",void 0,e)}catch{await V(e)}}async function V(e){let o=encodeURIComponent(e),t=l.Uri.parse(`vscode://anthropic.claude-code/open?prompt=${o}`);try{await l.env.openExternal(t)||await R()}catch{await R()}}async function R(){await l.window.showErrorMessage("Claude Code extension not found. Please install it from the marketplace.","Install Claude Code")==="Install Claude Code"&&await l.commands.executeCommand("workbench.extensions.installExtension","anthropic.claude-code")}var h=p(require("vscode"));function v(){let e=h.window.activeTextEditor;if(!e)return null;let o=h.workspace.asRelativePath(e.document.uri),t=e.selection;if(!t.isEmpty){let n=t.start.line+1,m=t.end.line+1;return{filePath:o,lineRange:`${n}-${m}`,hasSelection:!0}}return{filePath:o,hasSelection:!1}}var c="delphi-dev",i={WRITE:`${c}.write`,AUDIT:`${c}.audit`,REVIEW:`${c}.review`,SPEC:`${c}.spec`,TDD:`${c}.tdd`,NEW_PROJECT:`${c}.newProject`,ABOUT:`${c}.about`,CREATE_CLAUDEIGNORE:`${c}.createClaudeignore`,BUILD:`${c}.build`,REFACTOR:`${c}.refactor`,MIGRATE:`${c}.migrate`,CONTRIBUTE_KB:`${c}.contributeKb`},A={COMMANDS_TREE:"delphiDevCommands"},y={IS_DELPHI_PROJECT:`${c}.isDelphiProject`};var k="**/*.{dpr,pas,dfm,dpk,inc,fmx}",_="**/*.dpr";function g(e,o){return o?`@${e}:${o}`:`@${e}`}async function z(){await a("/write")}async function Y(){await a("/audit")}async function q(){let e=v();if(e){let o=g(e.filePath,e.lineRange);await a(`/review ${o}`)}else await a("/review")}async function Q(){await a("/spec")}async function Z(){let e=v();e?await a(`/tdd ${g(e.filePath)}`):await a("/tdd")}async function ee(){await a("/new-project")}async function oe(){await a("/about")}async function te(){await a("/build")}async function ie(){let e=v();e?await a(`/refactor ${g(e.filePath)}`):await a("/refactor")}async function ne(){let e=v();e?await a(`/migrate --file ${g(e.filePath)}`):await a("/migrate")}async function se(){await a("/contribute-kb")}function N(e){e.subscriptions.push(d.commands.registerCommand(i.WRITE,z),d.commands.registerCommand(i.AUDIT,Y),d.commands.registerCommand(i.REVIEW,q),d.commands.registerCommand(i.SPEC,Q),d.commands.registerCommand(i.TDD,Z),d.commands.registerCommand(i.NEW_PROJECT,ee),d.commands.registerCommand(i.ABOUT,oe),d.commands.registerCommand(i.BUILD,te),d.commands.registerCommand(i.REFACTOR,ie),d.commands.registerCommand(i.MIGRATE,ne),d.commands.registerCommand(i.CONTRIBUTE_KB,se))}var r=p(require("vscode"));var ae=[{label:"Write Code",description:"Create new Delphi code with standards",command:i.WRITE,icon:new r.ThemeIcon("edit")},{label:"Review Code",description:"Quick code review for style violations",command:i.REVIEW,icon:new r.ThemeIcon("eye")},{label:"Audit Project",description:"Complete technical audit report",command:i.AUDIT,icon:new r.ThemeIcon("checklist")},{label:"Generate Spec",description:"Auto-generate SPEC from source code",command:i.SPEC,icon:new r.ThemeIcon("file-text")},{label:"Generate Tests (TDD)",description:"Generate DUnitX test suite",command:i.TDD,icon:new r.ThemeIcon("beaker")},{label:"New Project",description:"Scaffold a new Delphi project",command:i.NEW_PROJECT,icon:new r.ThemeIcon("folder-opened")},{label:"Build Project",description:"Compile and validate with delphi-builder",command:i.BUILD,icon:new r.ThemeIcon("play")},{label:"Refactor Code",description:"Refactor following Pascal idioms",command:i.REFACTOR,icon:new r.ThemeIcon("wand")},{label:"Migrate Legacy",description:"Analyze and plan legacy code modernization",command:i.MIGRATE,icon:new r.ThemeIcon("arrow-right")},{label:"Contribute Knowledge",description:"Share your learnings with the community",command:i.CONTRIBUTE_KB,icon:new r.ThemeIcon("cloud-upload")}],S=class extends r.TreeItem{constructor(o){super(o.label,r.TreeItemCollapsibleState.None),this.description=o.description,this.iconPath=o.icon,this.command={command:o.command,title:o.label},this.tooltip=o.description}},E=class{getTreeItem(o){return o}getChildren(){let o=ae.map(t=>new S(t));return Promise.resolve(o)}};var w=p(require("vscode"));var T;async function D(){let o=(await w.workspace.findFiles(_,null,1)).length>0;return await w.commands.executeCommand("setContext",y.IS_DELPHI_PROJECT,o),o}function B(e,o){T=w.workspace.createFileSystemWatcher(k);let t=async()=>{let n=await D();o(n)};T.onDidCreate(t),T.onDidDelete(t),e.subscriptions.push(T)}var f=p(require("vscode"));var u;function M(e){u=f.window.createStatusBarItem(f.StatusBarAlignment.Left,50),u.text="$(tools) Delphi Dev",u.tooltip="Delphi Dev for Claude Code - Click for commands",u.command=i.ABOUT,e.subscriptions.push(u)}function I(e){if(!u)return;let t=f.workspace.getConfiguration("delphiDev").get("showStatusBar",!0);e&&t?u.show():u.hide()}var s=p(require("vscode")),$=`# =============================================
# .claudeignore \u2014 Projeto Delphi
# Gerado automaticamente pelo plugin delphi-dev
# =============================================

# --- Arquivos compilados e binarios ---
*.dcu
*.exe
*.dll
*.bpl
*.dcp
*.rsm
*.so
*.dylib
*.apk
*.ipa

# --- Recursos compilados ---
*.res
*.dres

# --- Configuracao e metadados de IDE ---
*.dproj
*.dof
*.cfg
*.local
*.identcache
*.projdata
*.tvsconfig
*.dsk

# --- Mapas e debug ---
*.map
*.drc
*.jdbg

# --- Arquivos temporarios ---
*.~*
*.bak
*.tmp
*.log

# --- Saidas de compilacao por plataforma ---
Win32/
Win64/
Android/
Android64/
iOSDevice32/
iOSDevice64/
iOSSimulator/
OSX64/
OSXARM64/
Linux64/

# --- Historico e backup de IDE ---
__history/
__recovery/

# --- Outros ---
*.svn/
.git/
node_modules/
`,U="delphiDev.claudeignoreDismissed";async function b(e){if(!s.workspace.getConfiguration("delphiDev").get("autoCreateClaudeignore",!0)||e.workspaceState.get(U,!1))return;let n=s.workspace.workspaceFolders;if(!n||n.length===0)return;let m=n[0].uri,P=s.Uri.joinPath(m,".claudeignore");try{await s.workspace.fs.stat(P);return}catch{}if(await s.window.showInformationMessage("Delphi project detected. Create .claudeignore to optimize Claude Code performance?","Create","Not now")==="Create"){let F=new TextEncoder;await s.workspace.fs.writeFile(P,F.encode($)),s.window.showInformationMessage(".claudeignore created successfully.")}else await e.workspaceState.update(U,!0)}function L(e){e.subscriptions.push(s.commands.registerCommand("delphi-dev.createClaudeignore",async()=>{let o=s.workspace.workspaceFolders;if(!o||o.length===0){s.window.showWarningMessage("No workspace folder open.");return}let t=o[0].uri,n=s.Uri.joinPath(t,".claudeignore");try{if(await s.workspace.fs.stat(n),await s.window.showWarningMessage(".claudeignore already exists. Overwrite with Delphi defaults?","Overwrite","Cancel")!=="Overwrite")return}catch{}let m=new TextEncoder;await s.workspace.fs.writeFile(n,m.encode($)),s.window.showInformationMessage(".claudeignore created with Delphi defaults.")}))}async function re(e){N(e),L(e);let o=new E;x.window.createTreeView(A.COMMANDS_TREE,{treeDataProvider:o}),M(e);let t=await D();I(t),t&&b(e),B(e,n=>{I(n),n&&b(e)}),e.subscriptions.push(x.workspace.onDidChangeConfiguration(n=>{n.affectsConfiguration("delphiDev.showStatusBar")&&D().then(I)}))}function ce(){}0&&(module.exports={activate,deactivate});
//# sourceMappingURL=extension.js.map
