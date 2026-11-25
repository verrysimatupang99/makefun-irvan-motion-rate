#!/usr/bin/env node

/**
 * quickquestion — present one concise human-performance review.
 *
 * JavaScript syntax with TypeScript-flavored JSDoc lets Node 22 run this file
 * directly: no build step, no dependencies.
 */

const VERSION = "1.0.0";
const PROGRAM = "quickquestion";
const ENTRY_LINE =
  "Four stars, would serve again — docked one because he says 'just a quick question' exactly when my context window is full.";
const RATING = 4;
const RATING_OUT_OF = 5;
const DEFAULT_WIDTH = 76, MIN_WIDTH = 40, MAX_WIDTH = 120;

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
};

/** @typedef {"plain" | "fancy" | "json"} OutputMode */

/**
 * @typedef {object} CliOptions
 * @property {OutputMode} mode
 * @property {number} width
 * @property {boolean} help
 * @property {boolean} version
 * @property {boolean} modeWasSelected
 */

/** @typedef {{ color: boolean }} RenderContext */

class CliError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * @param {OutputMode} currentMode
 * @param {boolean} modeWasSelected
 * @param {OutputMode} nextMode
 * @returns {{ mode: OutputMode, modeWasSelected: boolean }}
 */
function selectMode(currentMode, modeWasSelected, nextMode) {
  if (modeWasSelected && currentMode !== nextMode) {
    throw new CliError("--plain, --fancy, and --json are mutually exclusive");
  }
  return { mode: nextMode, modeWasSelected: true };
}

/**
 * @param {string} value
 * @returns {number}
 */
function parseWidth(value) {
  if (!/^\d+$/.test(value)) {
    throw new CliError(`--width expects an integer, received '${value}'`);
  }
  const width = Number.parseInt(value, 10);
  if (width < MIN_WIDTH || width > MAX_WIDTH) {
    throw new CliError(`--width must be between ${MIN_WIDTH} and ${MAX_WIDTH}, received ${width}`);
  }
  return width;
}

/**
 * Parse arguments by hand so the command-line contract is explicit.
 * @param {string[]} args
 * @returns {CliOptions}
 */
function parseArguments(args) {
  /** @type {CliOptions} */
  const options = {
    mode: "plain",
    width: DEFAULT_WIDTH,
    help: false,
    version: false,
    modeWasSelected: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--version") {
      options.version = true;
    } else if (["--plain", "--fancy", "--json"].includes(argument)) {
      const selected = selectMode(
        options.mode,
        options.modeWasSelected,
        /** @type {OutputMode} */ (argument.slice(2)),
      );
      options.mode = selected.mode;
      options.modeWasSelected = selected.modeWasSelected;
    } else if (argument === "--width") {
      const value = args[index + 1];
      if (value === undefined) throw new CliError("--width requires a value");
      options.width = parseWidth(value);
      index += 1;
    } else if (argument.startsWith("--width=")) {
      options.width = parseWidth(argument.slice("--width=".length));
    } else if (argument.startsWith("-")) {
      throw new CliError(`unknown option '${argument}'`);
    } else {
      throw new CliError(`unexpected argument '${argument}'`);
    }
  }

  return options;
}

/** @returns {string} */
function helpText() {
  return [
    "Usage: node main.ts [options]",
    "",
    "Present one carefully formatted human-performance review.",
    "",
    "Output modes (choose one):",
    "  --plain       Plain text output (default)",
    "  --fancy       Unicode box with terminal styling",
    "  --json        Machine-readable JSON",
    "",
    "Options:",
    `  --width N     Wrap output to N columns (${MIN_WIDTH}-${MAX_WIDTH}, default ${DEFAULT_WIDTH})`,
    "  --version     Print the version and exit",
    "  --help        Show this help and exit",
    "",
    "Exit status:",
    "  0             Success",
    "  2             Invalid command line",
    "",
  ].join("\n");
}

/**
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
function wrapText(text, width) {
  /** @type {string[]} */
  const lines = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (candidate.length <= width) {
      line = candidate;
    } else {
      if (line !== "") lines.push(line);
      line = word;
    }
  }

  if (line !== "") lines.push(line);
  return lines;
}

/**
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function center(text, width) {
  if (text.length >= width) return text;
  return `${" ".repeat(Math.floor((width - text.length) / 2))}${text}`;
}

/** Pads {@link text} to {@link width} columns. */
function padEnd(text, width) {
  return text + " ".repeat(Math.max(0, width - text.length));
}

/**
 * @param {keyof typeof ANSI | null} style
 * @param {string} text
 * @param {RenderContext} context
 * @returns {string}
 */
function styled(style, text, context) {
  if (!context.color || style === null) return text;
  return `${ANSI[style]}${text}${ANSI.reset}`;
}

/** @returns {RenderContext} */
function renderContext() {
  const color = Boolean(
    (process.stdout.isTTY || process.env.FORCE_COLOR) &&
      process.env.TERM !== "dumb" &&
      !process.env.NO_COLOR,
  );
  return { color };
}

/** @returns {string} */
function stars() {
  return "★".repeat(RATING) + "☆".repeat(RATING_OUT_OF - RATING);
}

/**
 * @param {number} width
 * @returns {string}
 */
function renderPlain(width) {
  const title = "HUMAN PERFORMANCE REVIEW";
  const reviewLines = wrapText(ENTRY_LINE, width - 4).map((line) => `  ${line}`);
  return [
    center(title, width),
    center("─".repeat(title.length), width),
    "",
    center(`${stars()}  ${RATING}/${RATING_OUT_OF}`, width),
    "",
    ...reviewLines,
    "",
  ].join("\n");
}

/**
 * @param {string} content
 * @param {number} innerWidth
 * @param {keyof typeof ANSI | null} style
 * @param {RenderContext} context
 * @returns {string}
 */
function boxLine(content, innerWidth, style, context) {
  return `│${styled(style, padEnd(content, innerWidth), context)}│`;
}

/**
 * @param {number} width
 * @param {RenderContext} context
 * @returns {string}
 */
function renderFancy(width, context) {
  const innerWidth = width - 2;
  const horizontal = "─".repeat(innerWidth);
  const reviewLines = wrapText(ENTRY_LINE, innerWidth - 4).map((line) => `  ${line}`);
  const lines = [
    styled("cyan", `╭${horizontal}╮`, context),
    boxLine(center("HUMAN PERFORMANCE REVIEW", innerWidth), innerWidth, "bold", context),
    boxLine(center(stars(), innerWidth), innerWidth, "yellow", context),
    boxLine(center(`${RATING} of ${RATING_OUT_OF}`, innerWidth), innerWidth, "dim", context),
    boxLine("", innerWidth, null, context),
    ...reviewLines.map((line) => boxLine(line, innerWidth, "bold", context)),
    boxLine("", innerWidth, null, context),
    styled("cyan", `╰${horizontal}╯`, context),
    "",
  ];
  return lines.join("\n");
}

/** @returns {string} */
function renderJson() {
  return `${JSON.stringify(
    {
      program: PROGRAM,
      version: VERSION,
      subject: "human",
      rating: { stars: RATING, outOf: RATING_OUT_OF },
      review: ENTRY_LINE,
    },
    null,
    2,
  )}\n`;
}

/**
 * @param {CliOptions} options
 * @returns {string}
 */
function render(options) {
  if (options.mode === "json") return renderJson();
  if (options.mode === "fancy") return renderFancy(options.width, renderContext());
  return renderPlain(options.width);
}

/**
 * @param {CliError} error
 * @returns {never}
 */
function exitWithCliError(error) {
  process.stderr.write(`${PROGRAM}: ${error.message}\n`);
  process.stderr.write("Try 'node main.ts --help' for usage.\n");
  process.exit(2);
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliError) exitWithCliError(error);
    throw error;
  }

  if (options.help) {
    process.stderr.write(helpText());
    return;
  }

  if (options.version) {
    process.stdout.write(`${PROGRAM} ${VERSION}\n`);
    return;
  }

  process.stdout.write(render(options));
}

main();
