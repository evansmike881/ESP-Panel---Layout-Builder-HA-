$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputPath = Join-Path $root 'household-panel-live.yaml'
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line {
  param([string]$Text = '')
  [void]$lines.Add($Text)
}

function Add-SlotGlobals {
  param([int]$Slot)

  Add-Line "  - id: slot_${Slot}_visible"
  Add-Line '    type: bool'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "false"'
  Add-Line "  - id: slot_${Slot}_analogue"
  Add-Line '    type: bool'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "false"'
  Add-Line "  - id: slot_${Slot}_show_seconds"
  Add-Line '    type: bool'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "false"'
  Add-Line "  - id: slot_${Slot}_title_visible"
  Add-Line '    type: bool'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "true"'
  Add-Line "  - id: slot_${Slot}_border_visible"
  Add-Line '    type: bool'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "true"'
  Add-Line "  - id: slot_${Slot}_align_mode"
  Add-Line '    type: int'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0"'
  Add-Line "  - id: slot_${Slot}_x"
  Add-Line '    type: int'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0"'
  Add-Line "  - id: slot_${Slot}_y"
  Add-Line '    type: int'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0"'
  Add-Line "  - id: slot_${Slot}_w"
  Add-Line '    type: int'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "2"'
  Add-Line "  - id: slot_${Slot}_h"
  Add-Line '    type: int'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "2"'
  Add-Line "  - id: slot_${Slot}_title_text"
  Add-Line '    type: std::string'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: ''"Clock"'''
  Add-Line "  - id: slot_${Slot}_bg_color"
  Add-Line '    type: uint32_t'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0x12315A"'
  Add-Line "  - id: slot_${Slot}_border_color"
  Add-Line '    type: uint32_t'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0x6ED9FF"'
  Add-Line "  - id: slot_${Slot}_accent_color"
  Add-Line '    type: uint32_t'
  Add-Line '    restore_value: no'
  Add-Line '    initial_value: "0x9FC7FF"'
}

function Add-WidgetRefresh {
  param([int]$Slot)

  foreach ($suffix in @(
    'card', 'title_start', 'title_center', 'title_end',
    'digital_start', 'digital_center', 'digital_end',
    'analog_shell_seconds', 'analog_shell_plain',
    'analog_seconds', 'analog_plain'
  )) {
    Add-Line '      - lvgl.widget.refresh:'
    Add-Line "          id: slot_${Slot}_${suffix}"
  }
}

function Add-DigitalUpdates {
  param([int]$Slot)

  Add-Line '      - if:'
  Add-Line '          condition:'
  Add-Line "            lambda: return id(slot_${Slot}_visible) && !id(slot_${Slot}_analogue);"
  Add-Line '          then:'

  foreach ($align in @('start', 'center', 'end')) {
    Add-Line '            - lvgl.label.update:'
    Add-Line "                id: slot_${Slot}_time_${align}"
    Add-Line '                text: !lambda |-'
    Add-Line '                  auto now = id(ha_time).now();'
    Add-Line '                  if (!now.is_valid()) return std::string("--:--");'
    Add-Line '                  char buffer[16];'
    Add-Line "                  now.strftime(buffer, sizeof(buffer), id(slot_${Slot}_show_seconds) ? `"%H:%M:%S`" : `"%H:%M`");"
    Add-Line '                  return std::string(buffer);'
    Add-Line '            - lvgl.label.update:'
    Add-Line "                id: slot_${Slot}_date_${align}"
    Add-Line '                text: !lambda |-'
    Add-Line '                  auto now = id(ha_time).now();'
    Add-Line '                  if (!now.is_valid()) return std::string("-- ---");'
    Add-Line '                  char buffer[24];'
    Add-Line '                  now.strftime(buffer, sizeof(buffer), "%a %d %b");'
    Add-Line '                  return std::string(buffer);'
  }
}

function Add-AnalogUpdates {
  param([int]$Slot)

  Add-Line '      - if:'
  Add-Line '          condition:'
  Add-Line "            lambda: return id(slot_${Slot}_visible) && id(slot_${Slot}_analogue);"
  Add-Line '          then:'

  foreach ($suffix in @('minute_hand', 'hour_hand', 'second_hand', 'minute_hand_plain', 'hour_hand_plain')) {
    Add-Line '            - lvgl.indicator.update:'
    Add-Line "                id: slot_${Slot}_${suffix}"
    Add-Line '                value: !lambda |-'
    Add-Line '                  auto now = id(ha_time).now();'
    Add-Line '                  if (!now.is_valid()) return 0;'
    if ($suffix -like 'minute*') {
      Add-Line '                  return now.minute;'
    } elseif ($suffix -like 'hour*') {
      Add-Line '                  return (now.hour % 12) * 60 + now.minute;'
    } else {
      Add-Line '                  return now.second;'
    }
  }
}

function Add-WidgetBlock {
  param([int]$Slot)

  $i = '              '
  Add-Line "$i- obj:"
  Add-Line "$i    id: slot_${Slot}_card"
  Add-Line "$i    x: !lambda return id(slot_${Slot}_x) * 80;"
  Add-Line "$i    y: !lambda return id(slot_${Slot}_y) * 80;"
  Add-Line "$i    width: !lambda return id(slot_${Slot}_w) * 80;"
  Add-Line "$i    height: !lambda return id(slot_${Slot}_h) * 80;"
  Add-Line "$i    hidden: !lambda return !id(slot_${Slot}_visible);"
  Add-Line "$i    bg_color: !lambda return lv_color_hex(id(slot_${Slot}_bg_color));"
  Add-Line "$i    bg_grad_color: 0x081428"
  Add-Line "$i    bg_grad_dir: VER"
  Add-Line "$i    border_color: !lambda return lv_color_hex(id(slot_${Slot}_border_color));"
  Add-Line "$i    border_width: !lambda |-"
  Add-Line "$i      return id(slot_${Slot}_border_visible) ? 1 : 0;"
  Add-Line "$i    radius: 22"
  Add-Line "$i    pad_all: 14"
  Add-Line "$i    scrollable: false"
  Add-Line "$i    widgets:"

  foreach ($titleVariant in @(
    @{ Name = 'start'; Align = 'LEFT'; Mode = 0 },
    @{ Name = 'center'; Align = 'CENTER'; Mode = 1 },
    @{ Name = 'end'; Align = 'RIGHT'; Mode = 2 }
  )) {
    Add-Line "$i      - label:"
    Add-Line "$i          id: slot_${Slot}_title_$($titleVariant.Name)"
    Add-Line "$i          x: 0"
    Add-Line "$i          y: 0"
    Add-Line "$i          width: 100%"
    Add-Line "$i          hidden: !lambda return !id(slot_${Slot}_visible) || !id(slot_${Slot}_title_visible) || id(slot_${Slot}_title_text).empty() || id(slot_${Slot}_align_mode) != $($titleVariant.Mode);"
    Add-Line "$i          text: !lambda return id(slot_${Slot}_title_text);"
    Add-Line "$i          text_font: montserrat_bold_14"
    Add-Line "$i          text_color: !lambda return lv_color_hex(id(slot_${Slot}_accent_color));"
    Add-Line "$i          text_align: $($titleVariant.Align)"
  }

  foreach ($digitalVariant in @(
    @{ Name = 'start'; Cross = 'START'; Mode = 0; Align = $null },
    @{ Name = 'center'; Cross = 'CENTER'; Mode = 1; Align = 'CENTER' },
    @{ Name = 'end'; Cross = 'END'; Mode = 2; Align = 'RIGHT' }
  )) {
    Add-Line "$i      - obj:"
    Add-Line "$i          id: slot_${Slot}_digital_$($digitalVariant.Name)"
    Add-Line "$i          x: 0"
    Add-Line "$i          y: !lambda |-"
    Add-Line "$i            return (id(slot_${Slot}_title_visible) && !id(slot_${Slot}_title_text).empty()) ? 34 : 0;"
    Add-Line "$i          width: 100%"
    Add-Line "$i          height: !lambda |-"
    Add-Line "$i            return id(slot_${Slot}_h) * 80 - ((id(slot_${Slot}_title_visible) && !id(slot_${Slot}_title_text).empty()) ? 48 : 12);"
    Add-Line "$i          hidden: !lambda return !id(slot_${Slot}_visible) || id(slot_${Slot}_analogue) || id(slot_${Slot}_align_mode) != $($digitalVariant.Mode);"
    Add-Line "$i          bg_opa: TRANSP"
    Add-Line "$i          border_width: 0"
    Add-Line "$i          scrollable: false"
    Add-Line "$i          layout:"
    Add-Line "$i            type: FLEX"
    Add-Line "$i            flex_flow: COLUMN"
    Add-Line "$i            flex_align_main: CENTER"
    Add-Line "$i            flex_align_cross: $($digitalVariant.Cross)"
    Add-Line "$i            flex_align_track: CENTER"
    Add-Line "$i          widgets:"
    Add-Line "$i            - label:"
    Add-Line "$i                id: slot_${Slot}_time_$($digitalVariant.Name)"
    Add-Line "$i                text: ""--:--"""
    Add-Line "$i                text_font: montserrat_bold_52"
    Add-Line "$i                text_color: 0xF5F9FF"
    if ($digitalVariant.Align) {
      Add-Line "$i                text_align: $($digitalVariant.Align)"
      Add-Line "$i                width: 100%"
    }
    Add-Line "$i            - label:"
    Add-Line "$i                id: slot_${Slot}_date_$($digitalVariant.Name)"
    Add-Line "$i                text: ""-- ---"""
    Add-Line "$i                text_font: montserrat_18"
    Add-Line "$i                text_color: !lambda return lv_color_hex(id(slot_${Slot}_accent_color));"
    if ($digitalVariant.Align) {
      Add-Line "$i                text_align: $($digitalVariant.Align)"
      Add-Line "$i                width: 100%"
    }
  }

  foreach ($shellVariant in @(
    @{ Name = 'seconds'; Hidden = "!lambda return !id(slot_${Slot}_visible) || !id(slot_${Slot}_analogue) || !id(slot_${Slot}_show_seconds);"; Meter = "slot_${Slot}_analog_seconds"; Minute = "slot_${Slot}_minute_hand"; Hour = "slot_${Slot}_hour_hand"; IncludeSeconds = $true },
    @{ Name = 'plain'; Hidden = "!lambda return !id(slot_${Slot}_visible) || !id(slot_${Slot}_analogue) || id(slot_${Slot}_show_seconds);"; Meter = "slot_${Slot}_analog_plain"; Minute = "slot_${Slot}_minute_hand_plain"; Hour = "slot_${Slot}_hour_hand_plain"; IncludeSeconds = $false }
  )) {
    Add-Line "$i      - obj:"
    Add-Line "$i          id: slot_${Slot}_analog_shell_$($shellVariant.Name)"
    Add-Line "$i          x: 0"
    Add-Line "$i          y: !lambda |-"
    Add-Line "$i            return (id(slot_${Slot}_title_visible) && !id(slot_${Slot}_title_text).empty()) ? 28 : 0;"
    Add-Line "$i          width: 100%"
    Add-Line "$i          height: !lambda |-"
    Add-Line "$i            return id(slot_${Slot}_h) * 80 - ((id(slot_${Slot}_title_visible) && !id(slot_${Slot}_title_text).empty()) ? 42 : 10);"
    Add-Line "$i          hidden: $($shellVariant.Hidden)"
    Add-Line "$i          bg_opa: TRANSP"
    Add-Line "$i          border_width: 0"
    Add-Line "$i          pad_all: 0"
    Add-Line "$i          scrollable: false"
    Add-Line "$i          widgets:"
    Add-Line "$i            - obj:"
    Add-Line "$i                width: 150"
    Add-Line "$i                height: 150"
    Add-Line "$i                align: CENTER"
    Add-Line "$i                radius: 75"
    Add-Line "$i                bg_color: 0x040E1D"
    Add-Line "$i                border_color: !lambda return lv_color_hex(id(slot_${Slot}_border_color));"
    Add-Line "$i                border_width: 3"
    Add-Line "$i                pad_all: 0"
    Add-Line "$i                scrollable: false"
    Add-Line "$i            - meter:"
    Add-Line "$i                id: $($shellVariant.Meter)"
    Add-Line "$i                width: 150"
    Add-Line "$i                height: 150"
    Add-Line "$i                align: CENTER"
    Add-Line "$i                bg_opa: TRANSP"
    Add-Line "$i                border_width: 0"
    Add-Line "$i                pad_all: 0"
    Add-Line "$i                text_color: !lambda return lv_color_hex(id(slot_${Slot}_accent_color));"
    Add-Line "$i                scales:"
    Add-Line "$i                  - range_from: 0"
    Add-Line "$i                    range_to: 60"
    Add-Line "$i                    angle_range: 360"
    Add-Line "$i                    rotation: 270"
    Add-Line "$i                    ticks:"
    Add-Line "$i                      count: 2"
    Add-Line "$i                    indicators:"
    Add-Line "$i                      - line:"
    Add-Line "$i                          id: $($shellVariant.Minute)"
    Add-Line "$i                          width: 4"
    Add-Line "$i                          color: !lambda return lv_color_hex(id(slot_${Slot}_accent_color));"
    Add-Line "$i                          length: 52"
    Add-Line "$i                          rounded: true"
    Add-Line "$i                          value: 0"
    if ($shellVariant.IncludeSeconds) {
      Add-Line "$i                      - line:"
      Add-Line "$i                          id: slot_${Slot}_second_hand"
      Add-Line "$i                          width: 2"
      Add-Line "$i                          color: 0xFFD36B"
      Add-Line "$i                          length: 56"
      Add-Line "$i                          rounded: true"
      Add-Line "$i                          value: 0"
    }
    Add-Line "$i                  - range_from: 0"
    Add-Line "$i                    range_to: 12"
    Add-Line "$i                    angle_range: 360"
    Add-Line "$i                    rotation: 270"
    Add-Line "$i                    ticks:"
    Add-Line "$i                      count: 12"
    Add-Line "$i                      width: 3"
    Add-Line "$i                      length: 10"
    Add-Line "$i                      color: !lambda return lv_color_hex(id(slot_${Slot}_accent_color));"
    Add-Line "$i                  - range_from: 0"
    Add-Line "$i                    range_to: 720"
    Add-Line "$i                    angle_range: 360"
    Add-Line "$i                    rotation: 270"
    Add-Line "$i                    ticks:"
    Add-Line "$i                      count: 2"
    Add-Line "$i                    indicators:"
    Add-Line "$i                      - line:"
    Add-Line "$i                          id: $($shellVariant.Hour)"
    Add-Line "$i                          width: 6"
    Add-Line "$i                          color: 0xF7FBFF"
    Add-Line "$i                          length: 40"
    Add-Line "$i                          rounded: true"
    Add-Line "$i                          value: 0"
    Add-Line "$i            - obj:"
    Add-Line "$i                width: 12"
    Add-Line "$i                height: 12"
    Add-Line "$i                align: CENTER"
    Add-Line "$i                radius: 6"
    Add-Line "$i                bg_color: 0xF7FBFF"
    Add-Line "$i                border_width: 0"
    Add-Line "$i                pad_all: 0"
    Add-Line "$i                scrollable: false"
  }
}

Add-Line 'substitutions:'
Add-Line '  screen_width: "480"'
Add-Line '  screen_height: "480"'
Add-Line
Add-Line 'esphome:'
Add-Line '  name: household-panel'
Add-Line '  friendly_name: Household Panel'
Add-Line '  min_version: 2026.4.0'
Add-Line '  on_boot:'
Add-Line '    priority: -200'
Add-Line '    then:'
Add-Line '      - delay: 1s'
Add-Line '      - light.turn_on:'
Add-Line '          id: display_backlight'
Add-Line '          brightness: 85%'
Add-Line '      - script.execute: apply_live_layout'
Add-Line '      - script.execute: sync_clock_widgets'
Add-Line
Add-Line 'esp32:'
Add-Line '  board: esp32-s3-devkitc-1'
Add-Line '  variant: esp32s3'
Add-Line '  flash_size: 16MB'
Add-Line '  framework:'
Add-Line '    type: esp-idf'
Add-Line '    advanced:'
Add-Line '      execute_from_psram: true'
Add-Line
Add-Line 'psram:'
Add-Line '  mode: octal'
Add-Line '  speed: 80MHz'
Add-Line
Add-Line 'preferences:'
Add-Line '  flash_write_interval: 5min'
Add-Line
Add-Line 'logger:'
Add-Line '  level: WARN'
Add-Line
Add-Line 'api:'
Add-Line
Add-Line 'ota:'
Add-Line '  - platform: esphome'
Add-Line
Add-Line 'wifi:'
Add-Line '  ssid: !secret wifi_ssid'
Add-Line '  password: !secret wifi_password'
Add-Line '  on_connect:'
Add-Line '    then:'
Add-Line '      - delay: 1s'
Add-Line '      - script.execute: apply_live_layout'
Add-Line '      - script.execute: sync_clock_widgets'
Add-Line
Add-Line 'time:'
Add-Line '  - platform: homeassistant'
Add-Line '    id: ha_time'
Add-Line '    on_time_sync:'
Add-Line '      then:'
Add-Line '        - script.execute: apply_live_layout'
Add-Line '        - script.execute: sync_clock_widgets'
Add-Line '    on_time:'
Add-Line '      - seconds: /1'
Add-Line '        then:'
Add-Line '          - script.execute: sync_clock_widgets'
Add-Line
Add-Line 'output:'
Add-Line '  - platform: ledc'
Add-Line '    pin: GPIO38'
Add-Line '    id: gpio_backlight_pwm'
Add-Line '    frequency: 100Hz'
Add-Line
Add-Line 'light:'
Add-Line '  - platform: monochromatic'
Add-Line '    output: gpio_backlight_pwm'
Add-Line '    name: Display Backlight'
Add-Line '    id: display_backlight'
Add-Line '    restore_mode: ALWAYS_ON'
Add-Line
Add-Line 'i2c:'
Add-Line '  - id: bus_a'
Add-Line '    sda: GPIO19'
Add-Line '    scl:'
Add-Line '      number: GPIO45'
Add-Line '      ignore_strapping_warning: true'
Add-Line
Add-Line 'touchscreen:'
Add-Line '  platform: gt911'
Add-Line '  id: panel_touch'
Add-Line '  display: my_display'
Add-Line '  i2c_id: bus_a'
Add-Line '  transform:'
Add-Line '    mirror_x: true'
Add-Line '    mirror_y: true'
Add-Line '    swap_xy: false'
Add-Line
Add-Line 'spi:'
Add-Line '  - id: lcd_spi'
Add-Line '    clk_pin: GPIO48'
Add-Line '    mosi_pin: GPIO47'
Add-Line
Add-Line 'display:'
Add-Line '  - platform: mipi_rgb'
Add-Line '    id: my_display'
Add-Line '    model: GUITION-4848S040'
Add-Line '    auto_clear_enabled: false'
Add-Line '    update_interval: never'
Add-Line '    dimensions:'
Add-Line '      width: 480'
Add-Line '      height: 480'
Add-Line
Add-Line 'font:'
Add-Line '  - file:'
Add-Line '      type: gfonts'
Add-Line '      family: Montserrat'
Add-Line '      weight: 400'
Add-Line '    id: montserrat_18'
Add-Line '    size: 18'
Add-Line '    bpp: 4'
Add-Line '  - file:'
Add-Line '      type: gfonts'
Add-Line '      family: Montserrat'
Add-Line '      weight: 700'
Add-Line '    id: montserrat_bold_14'
Add-Line '    size: 14'
Add-Line '    bpp: 4'
Add-Line '  - file:'
Add-Line '      type: gfonts'
Add-Line '      family: Montserrat'
Add-Line '      weight: 700'
Add-Line '    id: montserrat_bold_52'
Add-Line '    size: 52'
Add-Line '    bpp: 4'
Add-Line
Add-Line 'text_sensor:'
foreach ($slot in 1..8) {
  Add-Line '  - platform: homeassistant'
  Add-Line "    id: slot_${slot}_payload"
  Add-Line "    entity_id: input_text.esp_panel_widget_slot_${slot}"
  Add-Line '    on_value:'
  Add-Line '      then:'
  Add-Line '        - script.execute: apply_live_layout'
}
Add-Line
Add-Line 'globals:'
foreach ($slot in 1..8) {
  Add-SlotGlobals -Slot $slot
}
Add-Line
Add-Line 'script:'
Add-Line '  - id: apply_live_layout'
Add-Line '    then:'
Add-Line '      - lambda: |-'
Add-Line '          auto parse_slot = [](const std::string &payload, bool &visible, bool &analogue, std::string &title, int &x, int &y, int &w, int &h, bool &show_seconds, bool &title_visible, bool &border_visible, int &align_mode, uint32_t &bg_color, uint32_t &border_color, uint32_t &accent_color) {'
Add-Line '            visible = false;'
Add-Line '            analogue = false;'
Add-Line '            title = "Clock";'
Add-Line '            x = 0;'
Add-Line '            y = 0;'
Add-Line '            w = 2;'
Add-Line '            h = 2;'
Add-Line '            show_seconds = false;'
Add-Line '            title_visible = true;'
Add-Line '            border_visible = true;'
Add-Line '            align_mode = 0;'
Add-Line '            bg_color = 0x12315A;'
Add-Line '            border_color = 0x6ED9FF;'
Add-Line '            accent_color = 0x9FC7FF;'
Add-Line '            if (payload.empty()) {'
Add-Line '              return;'
Add-Line '            }'
Add-Line
Add-Line '            std::vector<std::string> parts;'
Add-Line '            size_t start = 0;'
Add-Line '            while (true) {'
Add-Line '              size_t pos = payload.find(''|'', start);'
Add-Line '              if (pos == std::string::npos) {'
Add-Line '                parts.push_back(payload.substr(start));'
Add-Line '                break;'
Add-Line '              }'
Add-Line '              parts.push_back(payload.substr(start, pos - start));'
Add-Line '              start = pos + 1;'
Add-Line '            }'
Add-Line
Add-Line '            if (parts.size() < 8) {'
Add-Line '              return;'
Add-Line '            }'
Add-Line
Add-Line '            visible = parts[0] == "clock";'
Add-Line '            analogue = visible && parts[6] == "analogue";'
Add-Line '            title = parts[1];'
Add-Line '            x = std::max(0, std::min(4, atoi(parts[2].c_str())));'
Add-Line '            y = std::max(0, std::min(4, atoi(parts[3].c_str())));'
Add-Line '            w = std::max(2, std::min(6, atoi(parts[4].c_str())));'
Add-Line '            h = std::max(2, std::min(6, atoi(parts[5].c_str())));'
Add-Line '            if (x + w > 6) x = 6 - w;'
Add-Line '            if (y + h > 6) y = 6 - h;'
Add-Line '            show_seconds = atoi(parts[7].c_str()) == 1;'
Add-Line '            if (parts.size() >= 9) title_visible = atoi(parts[8].c_str()) == 1;'
Add-Line '            if (parts.size() >= 10) border_visible = atoi(parts[9].c_str()) == 1;'
Add-Line '            if (parts.size() >= 11) {'
Add-Line '              if (parts[10] == "center") align_mode = 1;'
Add-Line '              else if (parts[10] == "end") align_mode = 2;'
Add-Line '            }'
Add-Line '            if (parts.size() >= 12) bg_color = strtoul(parts[11].c_str(), nullptr, 16);'
Add-Line '            if (parts.size() >= 13) border_color = strtoul(parts[12].c_str(), nullptr, 16);'
Add-Line '            if (parts.size() >= 14) accent_color = strtoul(parts[13].c_str(), nullptr, 16);'
Add-Line '          };'
Add-Line
foreach ($slot in 1..8) {
  Add-Line "          parse_slot(id(slot_${slot}_payload).state, id(slot_${slot}_visible), id(slot_${slot}_analogue), id(slot_${slot}_title_text), id(slot_${slot}_x), id(slot_${slot}_y), id(slot_${slot}_w), id(slot_${slot}_h), id(slot_${slot}_show_seconds), id(slot_${slot}_title_visible), id(slot_${slot}_border_visible), id(slot_${slot}_align_mode), id(slot_${slot}_bg_color), id(slot_${slot}_border_color), id(slot_${slot}_accent_color));"
}
foreach ($slot in 1..8) {
  Add-WidgetRefresh -Slot $slot
}
Add-Line '      - script.execute: sync_clock_widgets'
Add-Line
Add-Line '  - id: sync_clock_widgets'
Add-Line '    then:'
foreach ($slot in 1..8) {
  Add-DigitalUpdates -Slot $slot
  Add-AnalogUpdates -Slot $slot
}
Add-Line
Add-Line 'lvgl:'
Add-Line '  rotation: 180'
Add-Line '  pages:'
Add-Line '    - id: main_page'
Add-Line '      bg_color: 0x08142D'
Add-Line '      pad_all: 0'
Add-Line '      scrollable: false'
Add-Line '      scrollbar_mode: "OFF"'
Add-Line '      widgets:'
Add-Line '        - obj:'
Add-Line '            id: screen_root'
Add-Line '            x: 0'
Add-Line '            y: 0'
Add-Line '            width: 480'
Add-Line '            height: 480'
Add-Line '            bg_color: 0x08142D'
Add-Line '            bg_grad_color: 0x050B16'
Add-Line '            bg_grad_dir: VER'
Add-Line '            border_width: 0'
Add-Line '            pad_all: 0'
Add-Line '            radius: 0'
Add-Line '            scrollable: false'
Add-Line '            widgets:'
foreach ($slot in 1..8) {
  Add-WidgetBlock -Slot $slot
}

[System.IO.File]::WriteAllLines($outputPath, $lines)
Write-Output "Wrote $outputPath"
