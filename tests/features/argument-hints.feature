Feature: Pi skill argument hints
  As a Pi user
  I want to see a skill's argument hint while composing its command
  So that I can use shared skills without memorizing their arguments

  Scenario: Show a loaded skill's argument hint
    Given a loaded skill declares argument-hint: "[--edit] [--days N]"
    When the editor contains the exact command "/skill:talking-points"
    Then Pi displays "[--edit] [--days N]" as muted inline hint text
    And the editor's submitted text remains "/skill:talking-points"

  Scenario: Display arbitrary hint text verbatim
    Given a loaded skill declares argument-hint: "<topic> [--format json]"
    When the editor contains that skill's exact command without arguments
    Then Pi displays "<topic> [--format json]" without interpreting it

  Scenario: Hide the hint for partial commands and entered arguments
    Given a loaded skill declares an argument hint
    When the editor contains a partial skill command or any argument text
    Then Pi displays no argument hint
    And the editor text and cursor position remain unchanged

  Scenario: Ignore missing, invalid, or unreadable hint metadata
    Given a loaded skill has no string argument-hint value
    When the editor contains that skill's exact command
    Then Pi displays no argument hint
    And the editor remains usable

  Scenario: Refresh hints after resource reload
    Given a loaded skill's argument-hint value changes
    When the user reloads Pi resources
    Then the editor displays the updated hint

  Scenario: Leave non-TUI modes unchanged
    Given Pi starts in a non-TUI mode
    When the extension starts
    Then it does not install a custom terminal editor
