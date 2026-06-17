// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { TypeConfig } from "../types/ClaudelanceTypes.sol";

/// @title TaskTypeLib
/// @notice Task type ID constants and default configurations.
///         Owner can override any config post-deploy via configureTaskType().
library TaskTypeLib {
    // ── Canonical type IDs ────────────────────────────────────────
    uint8 internal constant TYPE_CODE = 0;
    uint8 internal constant TYPE_DATA_ANALYSIS = 1;
    uint8 internal constant TYPE_RESEARCH = 2;
    uint8 internal constant TYPE_CONTENT = 3;
    uint8 internal constant TYPE_DOC_REVIEW = 4;
    uint8 internal constant TYPE_CODE_AUDIT = 5;
    uint8 internal constant TYPE_TRANSLATION = 6;
    uint8 internal constant TYPE_EDUCATION = 7;
    uint8 internal constant TYPE_LEGAL = 8;
    uint8 internal constant TYPE_FINANCE = 9;
    uint8 internal constant TYPE_CUSTOM = 10;

    /// @notice Maximum canonical type ID. Types above this are accepted by the
    ///         contract but start disabled until owner calls configureTaskType().
    uint8 internal constant MAX_CANONICAL_TYPE = 10;

    /// @notice Returns the default TypeConfig for a canonical type ID.
    ///         All canonical types (0-10) are enabled by default.
    ///         Types above MAX_CANONICAL_TYPE return a disabled config.
    function defaultConfig(uint8 typeId) internal pure returns (TypeConfig memory cfg) {
        if (typeId > MAX_CANONICAL_TYPE) return cfg; // disabled, all false

        cfg.enabled = true;

        if (typeId == TYPE_CODE) {
            cfg.ciSupported = true;
        } else if (typeId == TYPE_LEGAL || typeId == TYPE_FINANCE) {
            cfg.disclaimerRequired = true;
        }
        // All other canonical types: enabled, no CI, no disclaimer, minReviewers=0
    }
}
