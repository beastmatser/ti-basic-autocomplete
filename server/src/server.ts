/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true,
			},
		},
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true,
			},
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((_event) => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample',
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
	const textDocument = change.document;
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);
	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b\s[>|<|+|\-|*|→|≤|≥|≠]\s\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < 1000) {
		console.log(m);
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(m.index - 1),
				end: textDocument.positionAt(m.index + m[0].length + 1),
			},
			message: `${m[0]} is surrounded by spaces.`,
			source: 'ex',
		};
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index - 1),
				end: textDocument.positionAt(m.index + m[0].length + 1),
			},
			message: `${m[0]} is surrounded by spaces.`,
			source: 'ex',
		};
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{ label: 'abs', kind: CompletionItemKind.Function },
			{ label: 'and', kind: CompletionItemKind.Function },
			{ label: 'angle', kind: CompletionItemKind.Function },
			{ label: 'ANOVA', kind: CompletionItemKind.Function },
			{ label: 'Ans', kind: CompletionItemKind.Function },
			{ label: 'Archive', kind: CompletionItemKind.Function },
			{ label: 'Asm', kind: CompletionItemKind.Function },
			{ label: 'AsmComp', kind: CompletionItemKind.Function },
			{ label: 'AsmPrgm', kind: CompletionItemKind.Function },
			{ label: 'augment', kind: CompletionItemKind.Function },
			{ label: 'AxesOff', kind: CompletionItemKind.Function },
			{ label: 'AxesOn', kind: CompletionItemKind.Function },
			{ label: 'a+bi', kind: CompletionItemKind.Function },
			{ label: 'bal', kind: CompletionItemKind.Function },
			{ label: 'binomcdf', kind: CompletionItemKind.Function },
			{ label: 'binompdf', kind: CompletionItemKind.Function },
			{ label: 'Boxplot', kind: CompletionItemKind.Function },
			{ label: 'checkTmr', kind: CompletionItemKind.Function },
			{ label: 'x2cdf', kind: CompletionItemKind.Function },
			{ label: 'x2pdf', kind: CompletionItemKind.Function },
			{ label: 'x2-Test', kind: CompletionItemKind.Function },
			{ label: 'Circle', kind: CompletionItemKind.Function },
			{ label: 'Clear', kind: CompletionItemKind.Function },
			{ label: 'ClockOff', kind: CompletionItemKind.Function },
			{ label: 'ClockOn', kind: CompletionItemKind.Function },
			{ label: 'ClrAllLists', kind: CompletionItemKind.Function },
			{ label: 'ClrDraw', kind: CompletionItemKind.Function },
			{ label: 'ClrHome', kind: CompletionItemKind.Function },
			{ label: 'ClrList', kind: CompletionItemKind.Function },
			{ label: 'ClrTable', kind: CompletionItemKind.Function },
			{ label: 'conj', kind: CompletionItemKind.Function },
			{ label: 'Connected', kind: CompletionItemKind.Function },
			{ label: 'CoordOff', kind: CompletionItemKind.Function },
			{ label: 'CoordOn', kind: CompletionItemKind.Function },
			{ label: 'cos', kind: CompletionItemKind.Function },
			{ label: 'cos-1', kind: CompletionItemKind.Function },
			{ label: 'cosh', kind: CompletionItemKind.Function },
			{ label: 'cosh-1', kind: CompletionItemKind.Function },
			{ label: 'CubicReg', kind: CompletionItemKind.Function },
			{ label: 'cumSum', kind: CompletionItemKind.Function },
			{ label: 'dayOfWk', kind: CompletionItemKind.Function },
			{ label: 'dbd', kind: CompletionItemKind.Function },
			{ label: '▶Dec', kind: CompletionItemKind.Function },
			{ label: 'Degree', kind: CompletionItemKind.Function },
			{ label: 'DependAsk', kind: CompletionItemKind.Function },
			{ label: 'DependAuto', kind: CompletionItemKind.Function },
			{ label: 'det', kind: CompletionItemKind.Function },
			{ label: 'DiagnosticOff', kind: CompletionItemKind.Function },
			{ label: 'DiagnosticOn', kind: CompletionItemKind.Function },
			{ label: 'dim', kind: CompletionItemKind.Function },
			{ label: 'Disp', kind: CompletionItemKind.Function },
			{ label: 'DispGraph', kind: CompletionItemKind.Function },
			{ label: 'DispTable', kind: CompletionItemKind.Function },
			{ label: '▶DMS', kind: CompletionItemKind.Function },
			{ label: 'Dot', kind: CompletionItemKind.Function },
			{ label: 'DrawF', kind: CompletionItemKind.Function },
			{ label: 'DrawInv', kind: CompletionItemKind.Function },
			{ label: 'e', kind: CompletionItemKind.Function },
			{ label: 'e^', kind: CompletionItemKind.Function },
			{ label: 'E', kind: CompletionItemKind.Function },
			{ label: '▶Eff', kind: CompletionItemKind.Function },
			{ label: 'Eng', kind: CompletionItemKind.Function },
			{ label: 'Equ▶String', kind: CompletionItemKind.Function },
			{ label: 'expr', kind: CompletionItemKind.Function },
			{ label: 'ExprOff', kind: CompletionItemKind.Function },
			{ label: 'ExprOn', kind: CompletionItemKind.Function },
			{ label: 'Fcdf', kind: CompletionItemKind.Function },
			{ label: 'Fill', kind: CompletionItemKind.Function },
			{ label: 'Fix', kind: CompletionItemKind.Function },
			{ label: 'Float', kind: CompletionItemKind.Function },
			{ label: 'fMax', kind: CompletionItemKind.Function },
			{ label: 'fMin', kind: CompletionItemKind.Function },
			{ label: 'fnInt', kind: CompletionItemKind.Function },
			{ label: 'FnOff', kind: CompletionItemKind.Function },
			{ label: 'FnOn', kind: CompletionItemKind.Function },
			{ label: 'fPart', kind: CompletionItemKind.Function },
			{ label: 'Fpdf', kind: CompletionItemKind.Function },
			{ label: '▶Frac', kind: CompletionItemKind.Function },
			{ label: 'Full', kind: CompletionItemKind.Function },
			{ label: 'Func', kind: CompletionItemKind.Function },
			{ label: 'GarbageCollect', kind: CompletionItemKind.Function },
			{ label: 'gcd', kind: CompletionItemKind.Function },
			{ label: 'geometcdf', kind: CompletionItemKind.Function },
			{ label: 'geometpdf', kind: CompletionItemKind.Function },
			{ label: 'Get', kind: CompletionItemKind.Function },
			{ label: 'GetCalc', kind: CompletionItemKind.Function },
			{ label: 'GetDate', kind: CompletionItemKind.Function },
			{ label: 'getDtFmt', kind: CompletionItemKind.Function },
			{ label: 'getDtStr', kind: CompletionItemKind.Function },
			{ label: 'GetTime', kind: CompletionItemKind.Function },
			{ label: 'getTmFmt', kind: CompletionItemKind.Function },
			{ label: 'getTmStr', kind: CompletionItemKind.Function },
			{ label: 'getKey', kind: CompletionItemKind.Function },
			{ label: 'GridOff', kind: CompletionItemKind.Function },
			{ label: 'GridOn', kind: CompletionItemKind.Function },
			{ label: 'G-T', kind: CompletionItemKind.Function },
			{ label: 'Histogram', kind: CompletionItemKind.Function },
			{ label: 'Horiz', kind: CompletionItemKind.Function },
			{ label: 'Horizontal', kind: CompletionItemKind.Function },
			{ label: 'i', kind: CompletionItemKind.Function },
			{ label: 'identity', kind: CompletionItemKind.Function },
			{ label: 'imag', kind: CompletionItemKind.Function },
			{ label: 'IndpntAsk', kind: CompletionItemKind.Function },
			{ label: 'IndpntAuto', kind: CompletionItemKind.Function },
			{ label: 'Input', kind: CompletionItemKind.Function },
			{ label: 'inString', kind: CompletionItemKind.Function },
			{ label: 'int', kind: CompletionItemKind.Function },
			{ label: 'ΣInt', kind: CompletionItemKind.Function },
			{ label: 'intersect', kind: CompletionItemKind.Function },
			{ label: 'invNorm', kind: CompletionItemKind.Function },
			{ label: 'iPart', kind: CompletionItemKind.Function },
			{ label: 'irr', kind: CompletionItemKind.Function },
			{ label: 'isClockOn', kind: CompletionItemKind.Function },
			{ label: 'L', kind: CompletionItemKind.Function },
			{ label: 'LabelOff', kind: CompletionItemKind.Function },
			{ label: 'LabelOn', kind: CompletionItemKind.Function },
			{ label: 'lcm', kind: CompletionItemKind.Function },
			{ label: 'length', kind: CompletionItemKind.Function },
			{ label: 'Line', kind: CompletionItemKind.Function },
			{ label: 'LinReg', kind: CompletionItemKind.Function },
			{ label: 'LinReg', kind: CompletionItemKind.Function },
			{ label: 'LinRegTTest', kind: CompletionItemKind.Function },
			{ label: '∆List', kind: CompletionItemKind.Function },
			{ label: 'List▶matr', kind: CompletionItemKind.Function },
			{ label: 'ln', kind: CompletionItemKind.Function },
			{ label: 'LnReg', kind: CompletionItemKind.Function },
			{ label: 'log', kind: CompletionItemKind.Function },
			{ label: 'Logistic', kind: CompletionItemKind.Function },
			{ label: 'Matr▶list', kind: CompletionItemKind.Function },
			{ label: 'max', kind: CompletionItemKind.Function },
			{ label: 'mean', kind: CompletionItemKind.Function },
			{ label: 'median', kind: CompletionItemKind.Function },
			{ label: 'Med-Med', kind: CompletionItemKind.Function },
			{ label: 'min', kind: CompletionItemKind.Function },
			{ label: 'ModBoxplot', kind: CompletionItemKind.Function },
			{ label: 'nCr', kind: CompletionItemKind.Function },
			{ label: 'nDeriv', kind: CompletionItemKind.Function },
			{ label: '▶Nom', kind: CompletionItemKind.Function },
			{ label: 'Normal', kind: CompletionItemKind.Function },
			{ label: 'normalcdf', kind: CompletionItemKind.Function },
			{ label: 'normalpdf', kind: CompletionItemKind.Function },
			{ label: 'NormProbPlot', kind: CompletionItemKind.Function },
			{ label: 'not', kind: CompletionItemKind.Function },
			{ label: 'nPr', kind: CompletionItemKind.Function },
			{ label: 'npv', kind: CompletionItemKind.Function },
			{ label: 'or', kind: CompletionItemKind.Function },
			{ label: 'Output', kind: CompletionItemKind.Function },
			{ label: 'Param', kind: CompletionItemKind.Function },
			{ label: 'Plot1', kind: CompletionItemKind.Function },
			{ label: 'Plot2', kind: CompletionItemKind.Function },
			{ label: 'Plot3', kind: CompletionItemKind.Function },
			{ label: 'PlotsOff', kind: CompletionItemKind.Function },
			{ label: 'PlotsOn', kind: CompletionItemKind.Function },
			{ label: 'Pmt_Bgn', kind: CompletionItemKind.Function },
			{ label: 'Pmt_End', kind: CompletionItemKind.Function },
			{ label: 'poissoncdf', kind: CompletionItemKind.Function },
			{ label: 'poissonpdf', kind: CompletionItemKind.Function },
			{ label: 'Polar', kind: CompletionItemKind.Function },
			{ label: '▶Polar', kind: CompletionItemKind.Function },
			{ label: 'PolarGC', kind: CompletionItemKind.Function },
			{ label: '∑Prn', kind: CompletionItemKind.Function },
			{ label: 'prod', kind: CompletionItemKind.Function },
			{ label: 'Prompt', kind: CompletionItemKind.Function },
			{ label: '1-PropZInt', kind: CompletionItemKind.Function },
			{ label: '2-PropZInt', kind: CompletionItemKind.Function },
			{ label: '1-PropZTest', kind: CompletionItemKind.Function },
			{ label: '2-PropZTest', kind: CompletionItemKind.Function },
			{ label: 'Pt-Change', kind: CompletionItemKind.Function },
			{ label: 'Pt-Off', kind: CompletionItemKind.Function },
			{ label: 'Pt-On', kind: CompletionItemKind.Function },
			{ label: 'PwrReg', kind: CompletionItemKind.Function },
			{ label: 'Pxl-Change', kind: CompletionItemKind.Function },
			{ label: 'Pxl-Off', kind: CompletionItemKind.Function },
			{ label: 'Pxl-On', kind: CompletionItemKind.Function },
			{ label: 'Pxl-Test', kind: CompletionItemKind.Function },
			{ label: 'P▶Rx', kind: CompletionItemKind.Function },
			{ label: 'P▶Ry', kind: CompletionItemKind.Function },
			{ label: 'QuadReg', kind: CompletionItemKind.Function },
			{ label: 'QuartReg', kind: CompletionItemKind.Function },
			{ label: 'Radian', kind: CompletionItemKind.Function },
			{ label: 'rand', kind: CompletionItemKind.Function },
			{ label: 'randBin', kind: CompletionItemKind.Function },
			{ label: 'randInt', kind: CompletionItemKind.Function },
			{ label: 'randM', kind: CompletionItemKind.Function },
			{ label: 'randNorm', kind: CompletionItemKind.Function },
			{ label: 're^θi', kind: CompletionItemKind.Function },
			{ label: 'Real', kind: CompletionItemKind.Function },
			{ label: 'real', kind: CompletionItemKind.Function },
			{ label: 'RecallGDB', kind: CompletionItemKind.Function },
			{ label: 'RecallPic', kind: CompletionItemKind.Function },
			{ label: '▶Rect', kind: CompletionItemKind.Function },
			{ label: 'RectGC', kind: CompletionItemKind.Function },
			{ label: 'ref', kind: CompletionItemKind.Function },
			{ label: 'round', kind: CompletionItemKind.Function },
			{ label: '*row', kind: CompletionItemKind.Function },
			{ label: 'row', kind: CompletionItemKind.Function },
			{ label: 'row+', kind: CompletionItemKind.Function },
			{ label: '*row+', kind: CompletionItemKind.Function },
			{ label: 'row+', kind: CompletionItemKind.Function },
			{ label: 'rowSwap', kind: CompletionItemKind.Function },
			{ label: 'rref', kind: CompletionItemKind.Function },
			{ label: 'R▶Pr', kind: CompletionItemKind.Function },
			{ label: 'R▶Pθ', kind: CompletionItemKind.Function },
			{ label: '2-SampFTest', kind: CompletionItemKind.Function },
			{ label: '2-SampTInt', kind: CompletionItemKind.Function },
			{ label: '2-SampTTest', kind: CompletionItemKind.Function },
			{ label: '2-SampZInt', kind: CompletionItemKind.Function },
			{ label: '2-SampZTest', kind: CompletionItemKind.Function },
			{ label: 'Scatter', kind: CompletionItemKind.Function },
			{ label: 'Sci', kind: CompletionItemKind.Function },
			{ label: 'Select', kind: CompletionItemKind.Function },
			{ label: 'Send', kind: CompletionItemKind.Function },
			{ label: 'seq', kind: CompletionItemKind.Function },
			{ label: 'Seq', kind: CompletionItemKind.Function },
			{ label: 'Sequential', kind: CompletionItemKind.Function },
			{ label: 'setDate', kind: CompletionItemKind.Function },
			{ label: 'setDtFmt', kind: CompletionItemKind.Function },
			{ label: 'setTime', kind: CompletionItemKind.Function },
			{ label: 'setTmFmt', kind: CompletionItemKind.Function },
			{ label: 'SetUpEditor', kind: CompletionItemKind.Function },
			{ label: 'Shade', kind: CompletionItemKind.Function },
			{ label: 'Shadex2', kind: CompletionItemKind.Function },
			{ label: 'ShadeF', kind: CompletionItemKind.Function },
			{ label: 'ShadeNorm', kind: CompletionItemKind.Function },
			{ label: 'Shade_t', kind: CompletionItemKind.Function },
			{ label: 'Simul', kind: CompletionItemKind.Function },
			{ label: 'sin', kind: CompletionItemKind.Function },
			{ label: 'sin-1', kind: CompletionItemKind.Function },
			{ label: 'sinh', kind: CompletionItemKind.Function },
			{ label: 'sinh-1', kind: CompletionItemKind.Function },
			{ label: 'SinReg', kind: CompletionItemKind.Function },
			{ label: 'solve', kind: CompletionItemKind.Function },
			{ label: 'SortA', kind: CompletionItemKind.Function },
			{ label: 'SortD', kind: CompletionItemKind.Function },
			{ label: 'startTmr', kind: CompletionItemKind.Function },
			{ label: 'stdDev', kind: CompletionItemKind.Function },
			{ label: 'StoreGDB', kind: CompletionItemKind.Function },
			{ label: 'StorePic', kind: CompletionItemKind.Function },
			{ label: 'String►Equ', kind: CompletionItemKind.Function },
			{ label: 'sub', kind: CompletionItemKind.Function },
			{ label: 'sum', kind: CompletionItemKind.Function },
			{ label: 'tan', kind: CompletionItemKind.Function },
			{ label: 'tan-1', kind: CompletionItemKind.Function },
			{ label: 'Tangent', kind: CompletionItemKind.Function },
			{ label: 'tanh', kind: CompletionItemKind.Function },
			{ label: 'tanh-1', kind: CompletionItemKind.Function },
			{ label: 'tcdf', kind: CompletionItemKind.Function },
			{ label: 'Text', kind: CompletionItemKind.Function },
			{ label: 'Time', kind: CompletionItemKind.Function },
			{ label: 'timeCnv', kind: CompletionItemKind.Function },
			{ label: 'TInterval', kind: CompletionItemKind.Function },
			{ label: 'tpdf', kind: CompletionItemKind.Function },
			{ label: 'T-Test', kind: CompletionItemKind.Function },
			{ label: 'tmv_FV', kind: CompletionItemKind.Function },
			{ label: 'tmv_I%', kind: CompletionItemKind.Function },
			{ label: 'tmv_N', kind: CompletionItemKind.Function },
			{ label: 'tmv_Pmt', kind: CompletionItemKind.Function },
			{ label: 'tmv_PV', kind: CompletionItemKind.Function },
			{ label: 'UnArchive', kind: CompletionItemKind.Function },
			{ label: 'uvAxes', kind: CompletionItemKind.Function },
			{ label: 'uwAxes', kind: CompletionItemKind.Function },
			{ label: '1-Var', kind: CompletionItemKind.Function },
			{ label: '2-Var', kind: CompletionItemKind.Function },
			{ label: 'variance', kind: CompletionItemKind.Function },
			{ label: 'Vertical', kind: CompletionItemKind.Function },
			{ label: 'vwAxes', kind: CompletionItemKind.Function },
			{ label: 'Web', kind: CompletionItemKind.Function },
			{ label: 'xor', kind: CompletionItemKind.Function },
			{ label: 'xyLine', kind: CompletionItemKind.Function },
			{ label: 'ZBox', kind: CompletionItemKind.Function },
			{ label: 'ZDecimal', kind: CompletionItemKind.Function },
			{ label: 'ZInteger', kind: CompletionItemKind.Function },
			{ label: 'ZInterval', kind: CompletionItemKind.Function },
			{ label: 'Zoom', kind: CompletionItemKind.Function },
			{ label: 'Zoom', kind: CompletionItemKind.Function },
			{ label: 'ZoomFit', kind: CompletionItemKind.Function },
			{ label: 'ZoomRcl', kind: CompletionItemKind.Function },
			{ label: 'ZoomStat', kind: CompletionItemKind.Function },
			{ label: 'ZoomSto', kind: CompletionItemKind.Function },
			{ label: 'ZPrevious', kind: CompletionItemKind.Function },
			{ label: 'ZSquare', kind: CompletionItemKind.Function },
			{ label: 'ZStandard', kind: CompletionItemKind.Function },
			{ label: 'Z-Test', kind: CompletionItemKind.Function },
			{ label: 'ZTrig', kind: CompletionItemKind.Function },
			{ label: 'Input', kind: CompletionItemKind.Function },
			{ label: 'Prompt', kind: CompletionItemKind.Function },
			{ label: 'Disp', kind: CompletionItemKind.Function },
			{ label: 'DispGraph', kind: CompletionItemKind.Function },
			{ label: 'DispTable', kind: CompletionItemKind.Function },
			{ label: 'If', kind: CompletionItemKind.Keyword },
			{ label: 'Then', kind: CompletionItemKind.Keyword },
			{ label: 'Else', kind: CompletionItemKind.Keyword },
			{ label: 'For', kind: CompletionItemKind.Keyword },
			{ label: 'While', kind: CompletionItemKind.Keyword },
			{ label: 'Repeat', kind: CompletionItemKind.Keyword },
			{ label: 'End', kind: CompletionItemKind.Keyword },
			{ label: 'Pause', kind: CompletionItemKind.Keyword },
			{ label: 'Lbl', kind: CompletionItemKind.Keyword },
			{ label: 'Goto', kind: CompletionItemKind.Keyword },
			{ label: 'Wait', kind: CompletionItemKind.Keyword },
			{ label: 'IS>', kind: CompletionItemKind.Keyword },
			{ label: 'DS<', kind: CompletionItemKind.Keyword },
			{ label: 'Menu', kind: CompletionItemKind.Keyword },
			{ label: 'prgm', kind: CompletionItemKind.Keyword },
			{ label: 'Return', kind: CompletionItemKind.Keyword },
			{ label: 'Stop', kind: CompletionItemKind.Keyword },
			{ label: 'DelVar', kind: CompletionItemKind.Keyword },
			{ label: 'GraphStyle', kind: CompletionItemKind.Keyword },
			{ label: 'GraphColor', kind: CompletionItemKind.Keyword },
			{ label: 'OpenLib', kind: CompletionItemKind.Keyword },
			{ label: 'ExecLib', kind: CompletionItemKind.Keyword },
			{ label: 'BLUE', kind: CompletionItemKind.Color },
			{ label: 'RED', kind: CompletionItemKind.Color },
			{ label: 'BLACK', kind: CompletionItemKind.Color },
			{ label: 'MAGENTA', kind: CompletionItemKind.Color },
			{ label: 'GREEN', kind: CompletionItemKind.Color },
			{ label: 'ORANGE', kind: CompletionItemKind.Color },
			{ label: 'BROWN', kind: CompletionItemKind.Color },
			{ label: 'NAVY', kind: CompletionItemKind.Color },
			{ label: 'LTBLUE', kind: CompletionItemKind.Color },
			{ label: 'YELLOW', kind: CompletionItemKind.Color },
			{ label: 'LTGRAY', kind: CompletionItemKind.Color },
			{ label: 'MEDGREY', kind: CompletionItemKind.Color },
			{ label: 'GRAY', kind: CompletionItemKind.Color },
			{ label: 'DARKGRAY', kind: CompletionItemKind.Color },
			{ label: 'A', kind: CompletionItemKind.Variable },
			{ label: 'B', kind: CompletionItemKind.Variable },
			{ label: 'C', kind: CompletionItemKind.Variable },
			{ label: 'D', kind: CompletionItemKind.Variable },
			{ label: 'E', kind: CompletionItemKind.Variable },
			{ label: 'F', kind: CompletionItemKind.Variable },
			{ label: 'G', kind: CompletionItemKind.Variable },
			{ label: 'H', kind: CompletionItemKind.Variable },
			{ label: 'I', kind: CompletionItemKind.Variable },
			{ label: 'J', kind: CompletionItemKind.Variable },
			{ label: 'K', kind: CompletionItemKind.Variable },
			{ label: 'L', kind: CompletionItemKind.Variable },
			{ label: 'M', kind: CompletionItemKind.Variable },
			{ label: 'N', kind: CompletionItemKind.Variable },
			{ label: 'O', kind: CompletionItemKind.Variable },
			{ label: 'P', kind: CompletionItemKind.Variable },
			{ label: 'Q', kind: CompletionItemKind.Variable },
			{ label: 'R', kind: CompletionItemKind.Variable },
			{ label: 'S', kind: CompletionItemKind.Variable },
			{ label: 'T', kind: CompletionItemKind.Variable },
			{ label: 'U', kind: CompletionItemKind.Variable },
			{ label: 'V', kind: CompletionItemKind.Variable },
			{ label: 'W', kind: CompletionItemKind.Variable },
			{ label: 'X', kind: CompletionItemKind.Variable },
			{ label: 'Y', kind: CompletionItemKind.Variable },
			{ label: 'Z', kind: CompletionItemKind.Variable },
			{ label: 'θ', kind: CompletionItemKind.Variable },
			{ label: 'u', kind: CompletionItemKind.Variable },
			{ label: 'v', kind: CompletionItemKind.Variable },
			{ label: 'w', kind: CompletionItemKind.Variable },
			{ label: 'L1', kind: CompletionItemKind.Variable },
			{ label: 'L2', kind: CompletionItemKind.Variable },
			{ label: 'L3', kind: CompletionItemKind.Variable },
			{ label: 'L4', kind: CompletionItemKind.Variable },
			{ label: 'L5', kind: CompletionItemKind.Variable },
			{ label: 'L6', kind: CompletionItemKind.Variable },
			{ label: 'Str0', kind: CompletionItemKind.Variable },
			{ label: 'Str1', kind: CompletionItemKind.Variable },
			{ label: 'Str2', kind: CompletionItemKind.Variable },
			{ label: 'Str3', kind: CompletionItemKind.Variable },
			{ label: 'Str4', kind: CompletionItemKind.Variable },
			{ label: 'Str5', kind: CompletionItemKind.Variable },
			{ label: 'Str6', kind: CompletionItemKind.Variable },
			{ label: 'Str7', kind: CompletionItemKind.Variable },
			{ label: 'Str8', kind: CompletionItemKind.Variable },
			{ label: 'Str9', kind: CompletionItemKind.Variable },
			{ label: 'Pic0', kind: CompletionItemKind.Variable },
			{ label: 'Pic1', kind: CompletionItemKind.Variable },
			{ label: 'Pic2', kind: CompletionItemKind.Variable },
			{ label: 'Pic3', kind: CompletionItemKind.Variable },
			{ label: 'Pic4', kind: CompletionItemKind.Variable },
			{ label: 'Pic5', kind: CompletionItemKind.Variable },
			{ label: 'Pic6', kind: CompletionItemKind.Variable },
			{ label: 'Pic7', kind: CompletionItemKind.Variable },
			{ label: 'Pic8', kind: CompletionItemKind.Variable },
			{ label: 'Pic9', kind: CompletionItemKind.Variable },
			{ label: 'GDB0', kind: CompletionItemKind.Variable },
			{ label: 'GDB1', kind: CompletionItemKind.Variable },
			{ label: 'GDB2', kind: CompletionItemKind.Variable },
			{ label: 'GDB3', kind: CompletionItemKind.Variable },
			{ label: 'GDB4', kind: CompletionItemKind.Variable },
			{ label: 'GDB5', kind: CompletionItemKind.Variable },
			{ label: 'GDB6', kind: CompletionItemKind.Variable },
			{ label: 'Image0', kind: CompletionItemKind.Variable },
			{ label: 'Image1', kind: CompletionItemKind.Variable },
			{ label: 'Image2', kind: CompletionItemKind.Variable },
			{ label: 'Image3', kind: CompletionItemKind.Variable },
			{ label: 'Image4', kind: CompletionItemKind.Variable },
			{ label: 'Image5', kind: CompletionItemKind.Variable },
			{ label: 'Image6', kind: CompletionItemKind.Variable },
			{ label: 'Image7', kind: CompletionItemKind.Variable },
			{ label: 'Image8', kind: CompletionItemKind.Variable },
			{ label: 'Image9', kind: CompletionItemKind.Variable },
			{ label: 'Y0', kind: CompletionItemKind.Variable },
			{ label: 'Y1', kind: CompletionItemKind.Variable },
			{ label: 'Y2', kind: CompletionItemKind.Variable },
			{ label: 'Y3', kind: CompletionItemKind.Variable },
			{ label: 'Y4', kind: CompletionItemKind.Variable },
			{ label: 'Y5', kind: CompletionItemKind.Variable },
			{ label: 'Y6', kind: CompletionItemKind.Variable },
			{ label: 'Y7', kind: CompletionItemKind.Variable },
			{ label: 'Y8', kind: CompletionItemKind.Variable },
			{ label: 'Y9', kind: CompletionItemKind.Variable },
			{ label: 'r1', kind: CompletionItemKind.Variable },
			{ label: 'r2', kind: CompletionItemKind.Variable },
			{ label: 'r3', kind: CompletionItemKind.Variable },
			{ label: 'r4', kind: CompletionItemKind.Variable },
			{ label: 'r5', kind: CompletionItemKind.Variable },
			{ label: 'r6', kind: CompletionItemKind.Variable },
			{ label: '[A]', kind: CompletionItemKind.Variable },
			{ label: '[B]', kind: CompletionItemKind.Variable },
			{ label: '[C]', kind: CompletionItemKind.Variable },
			{ label: '[D]', kind: CompletionItemKind.Variable },
			{ label: '[E]', kind: CompletionItemKind.Variable },
			{ label: '[F]', kind: CompletionItemKind.Variable },
			{ label: '[G]', kind: CompletionItemKind.Variable },
			{ label: '[H]', kind: CompletionItemKind.Variable },
			{ label: '[I]', kind: CompletionItemKind.Variable },
			{ label: '[J]', kind: CompletionItemKind.Variable },
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
