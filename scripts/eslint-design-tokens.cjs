'use strict';

const path = require('path');

const COLOR_LITERAL_RE =
  /^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\(\s*[^)]+\))$/;

const COLOR_PROP_NAMES = new Set([
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'borderStartColor',
  'borderEndColor',
  'shadowColor',
  'tintColor',
  'background',
  'fill',
  'stroke',
  'colors',
  'placeholderTextColor',
  'trackColor',
  'thumbColor',
  'tabBarActiveTintColor',
  'tabBarInactiveTintColor',
  'prefixColor',
  'overlayColor',
  'textShadowColor',
  'selectionColor',
  'underlineColorAndroid',
]);

const PALETTE_VAR_RE = /(palette|color|colors|gradient|gradients|theme)/i;

function normalizeRelPath(filename) {
  if (!filename || filename === '<input>' || filename === '<text>') return '';
  const rel = path.relative(process.cwd(), filename);
  return rel.split(path.sep).join('/');
}

function isExemptFile(relPath) {
  if (!relPath) return true;
  if (!relPath.startsWith('src/')) return true;
  if (relPath.startsWith('src/theme/')) return true;
  if (relPath === 'src/constants/brand.ts') return true;
  if (relPath.endsWith('.d.ts')) return true;
  return false;
}

function getPropertyKeyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return null;
}

function isCssColorLiteral(node) {
  return (
    node &&
    node.type === 'Literal' &&
    typeof node.value === 'string' &&
    COLOR_LITERAL_RE.test(node.value.trim())
  );
}

function collectColorLiterals(node, out) {
  if (!node || typeof node !== 'object') return;
  if (isCssColorLiteral(node)) {
    out.push({ node, kind: 'color', value: node.value.trim() });
    return;
  }
  switch (node.type) {
    case 'ArrayExpression':
      for (const el of node.elements) collectColorLiterals(el, out);
      break;
    case 'ObjectExpression':
      for (const prop of node.properties) {
        if (prop.type === 'Property') collectColorLiterals(prop.value, out);
        else if (prop.type === 'SpreadElement') collectColorLiterals(prop.argument, out);
      }
      break;
    case 'ConditionalExpression':
      collectColorLiterals(node.consequent, out);
      collectColorLiterals(node.alternate, out);
      break;
    case 'LogicalExpression':
      collectColorLiterals(node.left, out);
      collectColorLiterals(node.right, out);
      break;
    case 'JSXExpressionContainer':
      collectColorLiterals(node.expression, out);
      break;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TypeAssertion':
      collectColorLiterals(node.expression, out);
      break;
    default:
      break;
  }
}

function reportRatchetResults(context, programNode, relPath, ratchetMap, items, ruleLabel) {
  const hasEntry = Object.prototype.hasOwnProperty.call(ratchetMap, relPath);
  if (!hasEntry) {
    for (const item of items) {
      context.report({
        node: item.node,
        message: item.message,
      });
    }
    return;
  }

  const allowed = ratchetMap[relPath];
  if (items.length === 0) {
    context.report({
      node: programNode,
      message: `File '${relPath}' sudah bersih (0 ${ruleLabel}) — hapus entri ini dari scripts/design-token-ratchet.json.`,
    });
    return;
  }

  if (items.length > allowed) {
    for (const item of items.slice(allowed)) {
      context.report({
        node: item.node,
        message: `${item.message} (ratchet '${relPath}' maks ${allowed}, ditemukan ${items.length}).`,
      });
    }
  }
}

const noHardcodedValuesRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded color literals and fontSize < 11 outside src/theme/, enforced via ratchet.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ratchet: { type: 'object' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const relPath = normalizeRelPath(context.filename || context.getFilename());
    if (isExemptFile(relPath)) return {};

    const options = context.options && context.options[0] ? context.options[0] : {};
    const ratchet = (options.ratchet && options.ratchet.hardcodedValues) || {};
    const violations = [];
    const seenNodes = new WeakSet();
    let programNode = null;

    function pushViolation(node, message) {
      if (!node || seenNodes.has(node)) return;
      seenNodes.add(node);
      violations.push({ node, message });
    }

    return {
      Program(node) {
        programNode = node;
      },
      Property(node) {
        if (node.computed) return;
        const keyName = getPropertyKeyName(node.key);
        if (!keyName) return;

        if (keyName === 'fontSize') {
          let valNode = node.value;
          if (
            valNode &&
            (valNode.type === 'TSAsExpression' || valNode.type === 'TSSatisfiesExpression')
          ) {
            valNode = valNode.expression;
          }
          if (valNode && valNode.type === 'Literal' && typeof valNode.value === 'number') {
            if (valNode.value < 11) {
              pushViolation(
                valNode,
                `fontSize ${valNode.value}px di bawah minimum aksesibilitas 11px; gunakan skala Typography dari @/theme.`,
              );
            }
          }
          return;
        }

        if (COLOR_PROP_NAMES.has(keyName)) {
          const found = [];
          collectColorLiterals(node.value, found);
          for (const item of found) {
            pushViolation(
              item.node,
              `Warna hardcode '${item.value}' pada properti '${keyName}' dilarang; gunakan token semantik dari @/theme.`,
            );
          }
        }
      },
      JSXAttribute(node) {
        const attrName = node.name && node.name.type === 'Identifier' ? node.name.name : null;
        if (!attrName || !COLOR_PROP_NAMES.has(attrName) || !node.value) return;

        const found = [];
        collectColorLiterals(node.value, found);
        for (const item of found) {
          pushViolation(
            item.node,
            `Warna hardcode '${item.value}' pada prop JSX '${attrName}' dilarang; gunakan token semantik dari @/theme.`,
          );
        }
      },
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== 'Identifier') return;
        if (!PALETTE_VAR_RE.test(node.id.name) || !node.init) return;
        const found = [];
        collectColorLiterals(node.init, found);
        for (const item of found) {
          pushViolation(
            item.node,
            `Warna hardcode '${item.value}' pada '${node.id.name}' dilarang; gunakan token semantik dari @/theme.`,
          );
        }
      },
      'Program:exit'() {
        reportRatchetResults(
          context,
          programNode,
          relPath,
          ratchet,
          violations,
          'pelanggaran token desain',
        );
      },
    };
  },
};

const noAlertAlertRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Alert.alert() in favor of inline validation, Toast, or BottomSheet.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ratchet: { type: 'object' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const relPath = normalizeRelPath(context.filename || context.getFilename());
    if (isExemptFile(relPath)) return {};

    const options = context.options && context.options[0] ? context.options[0] : {};
    const ratchet = (options.ratchet && options.ratchet.alertCalls) || {};
    const calls = [];
    let programNode = null;

    return {
      Program(node) {
        programNode = node;
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee &&
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Alert' &&
          callee.property &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'alert'
        ) {
          calls.push({
            node,
            message:
              'Alert.alert() dilarang untuk UI produksi; gunakan validasi inline, Toast, atau BottomSheet/ConfirmSheet.',
          });
        }
      },
      'Program:exit'() {
        reportRatchetResults(context, programNode, relPath, ratchet, calls, 'panggilan Alert.alert');
      },
    };
  },
};

module.exports = {
  rules: {
    'no-hardcoded-values': noHardcodedValuesRule,
    'no-alert-alert': noAlertAlertRule,
  },
};
