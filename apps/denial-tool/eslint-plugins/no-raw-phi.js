/**
 * no-raw-phi — ESLint rule for the denial-tool app.
 *
 * Forbids rendering known-PHI-bearing field accesses without a
 * <PrivacyField> wrapper. PR-4 carries this rule unchanged from PR-3.1.
 *
 * In PR-4 the backend does not yet expose PHI fields, so the rule
 * triggers on nothing in practice — but Phase 1.1 is expected to ship
 * denial events with reason_text + patient identifiers, and the rule
 * will start firing the moment those land. The PrivacyField escape
 * hatch is already in place.
 *
 * Tracked PHI field-access patterns:
 *   - denial.reason_text
 *   - denial.patient_identifier
 *   - claim.subscriber_id
 *   - claim.member_id
 *   - claim.subscriber_name
 *
 * The rule walks JSX expressions. Accesses inside a `<PrivacyField
 * value={...}>` attribute are allowed; everywhere else they're flagged.
 *
 * Implementation note: this is a v1 rule that only checks member-
 * expression patterns. It doesn't follow destructured aliases (`const
 * { reason_text } = denial; <span>{reason_text}</span>`) — that's a
 * known limitation. v2 could add lexical alias tracking.
 */

'use strict';

const PHI_FIELDS = [
  'reason_text',
  'patient_identifier',
  'subscriber_id',
  'member_id',
  'subscriber_name',
];

const noRawPhi = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow rendering raw PHI fields without <PrivacyField> wrapper.',
    },
    schema: [],
    messages: {
      rawPhi:
        'PHI field "{{field}}" must be wrapped in <PrivacyField value={...}>. Importing the raw value into JSX is not allowed.',
    },
  },

  create(context) {
    // Track whether we're inside a <PrivacyField value={...}> attribute.
    let privacyFieldAttrDepth = 0;

    function enterPrivacyAttr() {
      privacyFieldAttrDepth += 1;
    }
    function leavePrivacyAttr() {
      privacyFieldAttrDepth -= 1;
    }

    return {
      'JSXAttribute[name.name="value"]'(node) {
        const parent = node.parent;
        if (
          parent &&
          parent.type === 'JSXOpeningElement' &&
          parent.name &&
          parent.name.type === 'JSXIdentifier' &&
          parent.name.name === 'PrivacyField'
        ) {
          enterPrivacyAttr();
        }
      },
      'JSXAttribute[name.name="value"]:exit'(node) {
        const parent = node.parent;
        if (
          parent &&
          parent.type === 'JSXOpeningElement' &&
          parent.name &&
          parent.name.type === 'JSXIdentifier' &&
          parent.name.name === 'PrivacyField'
        ) {
          leavePrivacyAttr();
        }
      },

      MemberExpression(node) {
        if (privacyFieldAttrDepth > 0) return;
        if (
          node.property &&
          node.property.type === 'Identifier' &&
          PHI_FIELDS.includes(node.property.name)
        ) {
          // Only flag if we're inside JSX
          let p = node.parent;
          let inJsx = false;
          while (p) {
            if (
              p.type === 'JSXExpressionContainer' ||
              p.type === 'JSXElement'
            ) {
              inJsx = true;
              break;
            }
            p = p.parent;
          }
          if (inJsx) {
            context.report({
              node,
              messageId: 'rawPhi',
              data: { field: node.property.name },
            });
          }
        }
      },
    };
  },
};

export default {
  rules: {
    'no-raw-phi': noRawPhi,
  },
};
