#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <string>
#include <vector>

struct EspPanelWidgetGeometry {
  int card_w;
  int card_h;
  int icon_x;
  int icon_y;
  int icon_w;
  int icon_h;
  int icon_px;
  int label_x;
  int label_y;
  int label_w;
  int label_h;
  int label_px;
  int value_x;
  int value_y;
  int value_w;
  int value_h;
  int value_px;
  int text_align_code;
};

struct EspPanelTextBounds {
  int x;
  int w;
};

struct EspPanelRuntimeWidgetConfig {
  std::string type = "blank";
  bool visible = false;
  bool show_border = true;
  bool show_icon = true;
  bool show_label = true;
  bool show_value = true;
  std::string bg_color = "";
  std::string label = "";
  std::string icon = "shape";
  std::string content_align = "start";
  std::string layout_mode = "auto";
  std::string action = "";
  std::string label_transform = "none";
  std::string label_weight = "bold";
  std::string value_weight = "normal";
  std::string icon_color = "#FFD166";
  std::string label_color = "#A8C3EA";
  std::string value_color = "#F1F5F9";
  int icon_scale = 100;
  int label_scale = 100;
  int value_scale = 100;
  int x = 0;
  int y = 0;
  int w = 1;
  int h = 1;
};

struct EspPanelRuntimeThemeConfig {
  std::string theme_id = "blue";
  std::string screen_bg = "#08142D";
  std::string widget_bg = "#0D1B33";
  std::string widget_border = "#285EA8";
  std::string button_on_bg = "#14B8A6";
  std::string button_off_bg = "#1F2937";
  std::string overlay_bg = "#06101F";
  std::string overlay_title = "#FFD166";
  std::string overlay_text = "#F1F5F9";
};

static inline int esp_panel_clamp_int(int value, int min_value, int max_value) {
  return std::max(min_value, std::min(max_value, value));
}

static inline int esp_panel_scale_px(int base_px, int percent, int min_px, int max_px) {
  return esp_panel_clamp_int((base_px * percent + 50) / 100, min_px, max_px);
}

static inline int esp_panel_shrink_px(int px, int numerator, int denominator, int min_px) {
  if (denominator <= 0) {
    return px;
  }
  return esp_panel_clamp_int((px * numerator) / denominator, min_px, px);
}

static inline std::vector<std::string> esp_panel_split(const std::string &value, char delimiter = '|') {
  std::vector<std::string> parts;
  std::string current;
  for (char character : value) {
    if (character == delimiter) {
      parts.push_back(current);
      current.clear();
    } else {
      current.push_back(character);
    }
  }
  parts.push_back(current);
  return parts;
}

static inline int esp_panel_hex_digit(char character) {
  if (character >= '0' && character <= '9') return character - '0';
  if (character >= 'a' && character <= 'f') return 10 + character - 'a';
  if (character >= 'A' && character <= 'F') return 10 + character - 'A';
  return -1;
}

static inline std::string esp_panel_url_decode(const std::string &value) {
  std::string result;
  result.reserve(value.size());
  for (size_t index = 0; index < value.size(); index++) {
    const char character = value[index];
    if (character == '%' && index + 2 < value.size()) {
      const int high = esp_panel_hex_digit(value[index + 1]);
      const int low = esp_panel_hex_digit(value[index + 2]);
      if (high >= 0 && low >= 0) {
        result.push_back(static_cast<char>((high << 4) | low));
        index += 2;
        continue;
      }
    }
    if (character == '+') {
      result.push_back(' ');
    } else {
      result.push_back(character);
    }
  }
  return result;
}

static inline std::string esp_panel_runtime_text_field(
    const std::vector<std::string> &parts,
    size_t index,
    const std::string &fallback) {
  if (index >= parts.size()) {
    return fallback;
  }
  return esp_panel_url_decode(parts[index]);
}

static inline bool esp_panel_runtime_bool_field(
    const std::vector<std::string> &parts,
    size_t index,
    bool fallback) {
  const std::string value = esp_panel_runtime_text_field(parts, index, fallback ? "1" : "0");
  return value == "1" || value == "true" || value == "on";
}

static inline int esp_panel_runtime_int_field(
    const std::vector<std::string> &parts,
    size_t index,
    int fallback) {
  const std::string value = esp_panel_runtime_text_field(parts, index, "");
  if (value.empty()) {
    return fallback;
  }
  return std::atoi(value.c_str());
}

static inline EspPanelRuntimeWidgetConfig esp_panel_parse_widget_runtime(const std::string &encoded) {
  EspPanelRuntimeWidgetConfig config;
  const std::vector<std::string> parts = esp_panel_split(encoded);
  const bool has_layout_mode = parts.size() >= 24;
  const bool has_action = parts.size() >= 25;
  const size_t label_transform_index = has_layout_mode ? 11 : 10;
  const size_t label_weight_index = has_layout_mode ? 12 : 11;
  const size_t value_weight_index = has_layout_mode ? 13 : 12;
  const size_t icon_color_index = has_layout_mode ? 14 : 13;
  const size_t label_color_index = has_layout_mode ? 15 : 14;
  const size_t value_color_index = has_layout_mode ? 16 : 15;
  const size_t icon_scale_index = has_layout_mode ? 17 : 16;
  const size_t label_scale_index = has_layout_mode ? 18 : 17;
  const size_t value_scale_index = has_layout_mode ? 19 : 18;
  const size_t x_index = has_layout_mode ? 20 : 19;
  const size_t y_index = has_layout_mode ? 21 : 20;
  const size_t w_index = has_layout_mode ? 22 : 21;
  const size_t h_index = has_layout_mode ? 23 : 22;
  const size_t action_index = has_action ? parts.size() - 1 : SIZE_MAX;

  config.type = esp_panel_runtime_text_field(parts, 0, config.type);
  config.visible = esp_panel_runtime_bool_field(parts, 1, config.visible);
  config.show_border = esp_panel_runtime_bool_field(parts, 2, config.show_border);
  config.show_icon = esp_panel_runtime_bool_field(parts, 3, config.show_icon);
  config.show_label = esp_panel_runtime_bool_field(parts, 4, config.show_label);
  config.show_value = esp_panel_runtime_bool_field(parts, 5, config.show_value);
  config.bg_color = esp_panel_runtime_text_field(parts, 6, config.bg_color);
  config.label = esp_panel_runtime_text_field(parts, 7, config.label);
  config.icon = esp_panel_runtime_text_field(parts, 8, config.icon);
  config.content_align = esp_panel_runtime_text_field(parts, 9, config.content_align);
  if (has_layout_mode) {
    config.layout_mode = esp_panel_runtime_text_field(parts, 10, config.layout_mode);
  }
  config.label_transform = esp_panel_runtime_text_field(parts, label_transform_index, config.label_transform);
  config.label_weight = esp_panel_runtime_text_field(parts, label_weight_index, config.label_weight);
  config.value_weight = esp_panel_runtime_text_field(parts, value_weight_index, config.value_weight);
  config.icon_color = esp_panel_runtime_text_field(parts, icon_color_index, config.icon_color);
  config.label_color = esp_panel_runtime_text_field(parts, label_color_index, config.label_color);
  config.value_color = esp_panel_runtime_text_field(parts, value_color_index, config.value_color);
  config.icon_scale = esp_panel_runtime_int_field(parts, icon_scale_index, config.icon_scale);
  config.label_scale = esp_panel_runtime_int_field(parts, label_scale_index, config.label_scale);
  config.value_scale = esp_panel_runtime_int_field(parts, value_scale_index, config.value_scale);
  config.x = esp_panel_runtime_int_field(parts, x_index, config.x);
  config.y = esp_panel_runtime_int_field(parts, y_index, config.y);
  config.w = esp_panel_runtime_int_field(parts, w_index, config.w);
  config.h = esp_panel_runtime_int_field(parts, h_index, config.h);
  if (has_action) {
    config.action = esp_panel_runtime_text_field(parts, action_index, config.action);
  }
  return config;
}

static inline bool esp_panel_string_starts_with(const std::string &value, const char *prefix) {
  const size_t prefix_len = std::char_traits<char>::length(prefix);
  return value.size() >= prefix_len && value.compare(0, prefix_len, prefix) == 0;
}

static inline bool esp_panel_is_media_action(const std::string &value) {
  return esp_panel_string_starts_with(value, "media|");
}

static inline bool esp_panel_runtime_text_unavailable(const std::string &value) {
  return value == "unknown" || value == "unavailable";
}

static inline bool esp_panel_media_state_is_active(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });
  return value == "playing" || value == "buffering";
}

static inline std::string esp_panel_media_target(const std::string &value) {
  if (!esp_panel_is_media_action(value)) {
    return "";
  }
  const size_t first = value.find('|');
  if (first == std::string::npos) {
    return "";
  }
  const size_t second = value.find('|', first + 1);
  if (second == std::string::npos) {
    return "";
  }
  return value.substr(first + 1, second - first - 1);
}

static inline std::string esp_panel_media_url(const std::string &value) {
  if (!esp_panel_is_media_action(value)) {
    return "";
  }
  const size_t first = value.find('|');
  if (first == std::string::npos) {
    return "";
  }
  const size_t second = value.find('|', first + 1);
  if (second == std::string::npos || second + 1 >= value.size()) {
    return "";
  }
  return value.substr(second + 1);
}

static inline EspPanelRuntimeThemeConfig esp_panel_parse_theme_runtime(const std::string &encoded) {
  EspPanelRuntimeThemeConfig config;
  const std::vector<std::string> parts = esp_panel_split(encoded);
  config.theme_id = esp_panel_runtime_text_field(parts, 0, config.theme_id);
  config.screen_bg = esp_panel_runtime_text_field(parts, 1, config.screen_bg);
  config.widget_bg = esp_panel_runtime_text_field(parts, 2, config.widget_bg);
  config.widget_border = esp_panel_runtime_text_field(parts, 3, config.widget_border);
  config.button_on_bg = esp_panel_runtime_text_field(parts, 4, config.button_on_bg);
  config.button_off_bg = esp_panel_runtime_text_field(parts, 5, config.button_off_bg);
  config.overlay_bg = esp_panel_runtime_text_field(parts, 6, config.overlay_bg);
  config.overlay_title = esp_panel_runtime_text_field(parts, 7, config.overlay_title);
  config.overlay_text = esp_panel_runtime_text_field(parts, 8, config.overlay_text);
  return config;
}

static inline uint32_t esp_panel_parse_color(const std::string &value, uint32_t fallback) {
  if (value.size() != 7 || value[0] != '#') {
    return fallback;
  }

  for (size_t index = 1; index < value.size(); index++) {
    if (!std::isxdigit(static_cast<unsigned char>(value[index]))) {
      return fallback;
    }
  }

  return static_cast<uint32_t>(std::strtoul(value.c_str() + 1, nullptr, 16));
}

static inline uint32_t esp_panel_color_blend(uint32_t from, uint32_t to, uint8_t amount) {
  const uint8_t inv = static_cast<uint8_t>(255 - amount);
  const uint8_t from_r = static_cast<uint8_t>((from >> 16) & 0xFF);
  const uint8_t from_g = static_cast<uint8_t>((from >> 8) & 0xFF);
  const uint8_t from_b = static_cast<uint8_t>(from & 0xFF);
  const uint8_t to_r = static_cast<uint8_t>((to >> 16) & 0xFF);
  const uint8_t to_g = static_cast<uint8_t>((to >> 8) & 0xFF);
  const uint8_t to_b = static_cast<uint8_t>(to & 0xFF);

  const uint8_t out_r = static_cast<uint8_t>((from_r * inv + to_r * amount) / 255);
  const uint8_t out_g = static_cast<uint8_t>((from_g * inv + to_g * amount) / 255);
  const uint8_t out_b = static_cast<uint8_t>((from_b * inv + to_b * amount) / 255);

  return (static_cast<uint32_t>(out_r) << 16) | (static_cast<uint32_t>(out_g) << 8) | out_b;
}

static inline uint32_t esp_panel_color_lighten(uint32_t color, uint8_t amount) {
  return esp_panel_color_blend(color, 0xFFFFFF, amount);
}

static inline uint32_t esp_panel_color_darken(uint32_t color, uint8_t amount) {
  return esp_panel_color_blend(color, 0x000000, amount);
}

static inline int esp_panel_estimate_text_width(std::string value, int font_px) {
  if (value.empty()) {
    return std::max(8, font_px / 2);
  }

  int width = 0;
  for (unsigned char character : value) {
    if (character == ' ') {
      width += font_px / 3;
    } else if (std::isdigit(character)) {
      width += (font_px * 11) / 20;
    } else if (std::isupper(character)) {
      width += (font_px * 13) / 20;
    } else if (std::islower(character)) {
      width += (font_px * 11) / 20;
    } else {
      width += font_px / 2;
    }
  }

  return std::max(8, width + 4);
}

static inline std::string esp_panel_transform_label(std::string value, const std::string &transform) {
  if (transform == "uppercase") {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
      return static_cast<char>(std::toupper(character));
    });
  }
  return value;
}

static inline std::string esp_panel_preview_value_text(const std::string &type_name, const std::string &value) {
  if (type_name == "clock") {
    return "00:00";
  }
  if (type_name == "date") {
    return "00/00/0000";
  }
  return value;
}

static inline std::string esp_panel_trim(std::string value) {
  value.erase(value.begin(), std::find_if(value.begin(), value.end(), [](unsigned char ch) { return !std::isspace(ch); }));
  value.erase(std::find_if(value.rbegin(), value.rend(), [](unsigned char ch) { return !std::isspace(ch); }).base(), value.end());
  return value;
}

static inline int esp_panel_state_kind(std::string value) {
  value = esp_panel_trim(value);
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });

  if (value == "on" || value == "open" || value == "opening" || value == "online" || value == "true" || value == "active" || value == "home") {
    return 1;
  }
  if (value == "off" || value == "closed" || value == "closing" || value == "offline" || value == "false" || value == "inactive" || value == "away") {
    return -1;
  }
  return 0;
}

static inline uint32_t esp_panel_widget_bg_for_state(
    const std::string &type_name,
    const std::string &value,
    uint32_t fallback,
    uint32_t button_on,
    uint32_t button_off) {
  if (type_name != "button") {
    if (type_name != "media") {
      return fallback;
    }
  }

  const int kind = esp_panel_state_kind(value);
  if (kind > 0) {
    return button_on;
  }
  if (kind < 0) {
    return button_off;
  }
  return fallback;
}

static inline uint32_t esp_panel_widget_effective_bg(
    const std::string &type_name,
    const std::string &value,
    const std::string &override_value,
    uint32_t screen_bg,
    uint32_t widget_bg,
    uint32_t button_on,
    uint32_t button_off) {
  std::string normalized = esp_panel_trim(override_value);
  std::transform(normalized.begin(), normalized.end(), normalized.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });

  if (normalized == "transparent") {
    return screen_bg;
  }
  if (normalized.size() == 7 && normalized[0] == '#') {
    return esp_panel_parse_color(normalized, widget_bg);
  }

  return esp_panel_widget_bg_for_state(type_name, value, widget_bg, button_on, button_off);
}

static inline std::string esp_panel_icon_glyph(std::string icon_name, std::string type_name) {
  std::transform(icon_name.begin(), icon_name.end(), icon_name.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });
  std::transform(type_name.begin(), type_name.end(), type_name.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });

  if (icon_name.rfind("mdi:", 0) == 0) {
    icon_name = icon_name.substr(4);
  }

  std::replace(icon_name.begin(), icon_name.end(), '_', '-');
  std::replace(icon_name.begin(), icon_name.end(), ' ', '-');
  std::replace(type_name.begin(), type_name.end(), '_', '-');
  std::replace(type_name.begin(), type_name.end(), ' ', '-');

  if (icon_name.find("weather-sunny") != std::string::npos || icon_name == "sunny") return std::string("\U000F0599");
  if (icon_name.find("weather-partly") != std::string::npos || icon_name.find("partly") != std::string::npos) return std::string("\U000F0595");
  if (icon_name.find("weather-cloudy") != std::string::npos || icon_name.find("cloud") != std::string::npos) return std::string("\U000F0590");
  if (icon_name.find("weather-rainy") != std::string::npos || icon_name.find("rain") != std::string::npos) return std::string("\U000F0597");
  if (icon_name.find("weather-pouring") != std::string::npos || icon_name.find("shower") != std::string::npos) return std::string("\U000F0596");
  if (icon_name.find("weather-lightning") != std::string::npos || icon_name.find("thunder") != std::string::npos) return std::string("\U000F0593");
  if (icon_name.find("weather-snowy") != std::string::npos || icon_name.find("snow") != std::string::npos) return std::string("\U000F0598");
  if (icon_name.find("weather-fog") != std::string::npos || icon_name.find("fog") != std::string::npos || icon_name.find("mist") != std::string::npos) return std::string("\U000F0594");
  if (icon_name.find("thermometer") != std::string::npos || icon_name.find("temperature") != std::string::npos || type_name == "temperature") return std::string("\U000F050F");
  if (icon_name.find("water-percent") != std::string::npos || icon_name == "humidity" || icon_name.find("humidity") != std::string::npos || icon_name == "water" || type_name == "humidity") return std::string("\U000F058E");
  if (icon_name.find("ceiling-light") != std::string::npos || icon_name.find("lightbulb") != std::string::npos || icon_name.find("lamp") != std::string::npos || icon_name == "light" || type_name == "button") return std::string("\U000F0769");
  if (icon_name.find("speaker") != std::string::npos || icon_name.find("music") != std::string::npos || icon_name.find("radio") != std::string::npos || icon_name.find("audio") != std::string::npos || type_name == "media") return std::string("\U000F05A9");
  if (icon_name.find("clock") != std::string::npos || type_name == "clock") return std::string("\U000F0150");
  if (icon_name.find("calendar") != std::string::npos || type_name == "date") return std::string("\U000F00ED");
  if (icon_name.find("wifi") != std::string::npos) return std::string("\U000F05A9");
  if (icon_name.find("sofa") != std::string::npos) return std::string("\U000F04B9");
  if (icon_name.find("door") != std::string::npos || icon_name.find("garage") != std::string::npos || icon_name.find("gate") != std::string::npos) return std::string("\U000F081C");
  if (icon_name.find("home") != std::string::npos || icon_name.find("house") != std::string::npos || icon_name.find("scene") != std::string::npos) return std::string("\U000F07D0");
  if (icon_name.find("cog") != std::string::npos || icon_name.find("settings") != std::string::npos || icon_name.find("gear") != std::string::npos) return std::string("\U000F0493");
  if (icon_name.find("shape") != std::string::npos || icon_name.find("blank") != std::string::npos) return std::string("\U000F06E8");
  if (type_name == "weather") return std::string("\U000F0595");
  return std::string("\U000F06E8");
}

static inline EspPanelWidgetGeometry esp_panel_widget_geometry(
    int grid_w, int grid_h, const std::string &align, const std::string &layout_mode, const std::string &type_name, int icon_scale, int label_scale, int value_scale, bool show_icon, bool show_label, bool show_value) {
  const int card_w = std::max(1, grid_w) * 80 - 6;
  const int card_h = std::max(1, grid_h) * 80 - 6;
  const int min_side = std::min(card_w, card_h);
  const bool auto_value = type_name == "clock" || type_name == "date";
  const bool tall = card_h >= 148;
  const bool wide = card_w >= 228;
  const bool center_aligned = align == "center";
  const bool end_aligned = align == "end";
  const bool force_stacked = layout_mode == "stacked";
  const bool force_icon_right = layout_mode == "icon_right";
  const bool auto_layout = layout_mode.empty() || layout_mode == "auto";
  const bool squareish = card_h >= card_w - 12;
  const bool tiny = card_w <= 96;
  const bool stacked = force_stacked || (auto_layout && (tall || tiny || squareish));
  const bool icon_right = force_icon_right;
  const int padding = esp_panel_clamp_int(min_side / 10, 6, 16);
  const int gap = esp_panel_clamp_int(min_side / 18, 4, 12);

  EspPanelWidgetGeometry geometry{};
  geometry.card_w = card_w;
  geometry.card_h = card_h;

  if (!show_icon && !show_label && !show_value) {
    geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 0);
    return geometry;
  }

  if (show_value && !show_icon && !show_label) {
    const int value_px = esp_panel_scale_px(card_h / 2, value_scale, 16, 42);
    geometry.value_px = value_px;
    geometry.value_x = padding;
    geometry.value_y = std::max(padding, (card_h - value_px - 8) / 2);
    geometry.value_w = std::max(8, card_w - padding * 2);
    geometry.value_h = value_px + 12;
    geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 1);
    return geometry;
  }

  if (show_label && !show_icon && !show_value) {
    const int label_px = esp_panel_scale_px(tall ? 18 : 16, label_scale, 12, 30);
    geometry.label_px = label_px;
    geometry.label_x = padding;
    geometry.label_y = std::max(padding, (card_h - label_px - 8) / 2);
    geometry.label_w = std::max(8, card_w - padding * 2);
    geometry.label_h = label_px + 12;
    geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 1);
    return geometry;
  }

  if (show_icon && !show_label && !show_value) {
    const int icon_px = esp_panel_scale_px(min_side / 2, icon_scale, 24, 72);
    geometry.icon_px = icon_px;
    geometry.icon_w = std::min(card_w - padding * 2, icon_px + 16);
    geometry.icon_h = icon_px + 8;
    geometry.icon_x = (card_w - geometry.icon_w) / 2;
    geometry.icon_y = std::max(padding, (card_h - geometry.icon_h) / 2);
    geometry.text_align_code = 1;
    return geometry;
  }

  if (stacked) {
    int icon_px = esp_panel_scale_px(
        show_icon && show_label && show_value ? min_side / 3 : (tall ? min_side / 2 : min_side / 3),
        icon_scale,
        16,
        56);
    int label_px = esp_panel_scale_px(tall ? 14 : 12, label_scale, 9, 24);
    int value_px = esp_panel_scale_px(auto_value ? card_h / 4 : (show_icon && show_label ? card_h / 6 : card_h / 5), value_scale, 12, 34);
    int stack_gap = gap;

    int icon_h = show_icon ? icon_px + 6 : 0;
    int label_h = show_label ? label_px + 6 : 0;
    int value_h = show_value ? value_px + 6 : 0;
    int needed_h = icon_h + label_h + value_h;
    if (show_icon && (show_label || show_value)) needed_h += stack_gap;
    if (show_label && show_value) needed_h += stack_gap;
    const int available_h = std::max(24, card_h - padding * 2);

    if (needed_h > available_h) {
      icon_px = esp_panel_shrink_px(icon_px, available_h, needed_h, 14);
      label_px = esp_panel_shrink_px(label_px, available_h, needed_h, 9);
      value_px = esp_panel_shrink_px(value_px, available_h, needed_h, 11);
      stack_gap = std::max(3, (stack_gap * available_h) / needed_h);
      icon_h = show_icon ? icon_px + 6 : 0;
      label_h = show_label ? label_px + 6 : 0;
      value_h = show_value ? value_px + 6 : 0;
      needed_h = icon_h + label_h + value_h;
      if (show_icon && (show_label || show_value)) needed_h += stack_gap;
      if (show_label && show_value) needed_h += stack_gap;
    }

    geometry.icon_px = icon_px;
    geometry.label_px = label_px;
    geometry.value_px = value_px;

    geometry.icon_w = show_icon ? std::min(card_w - padding * 2, icon_px + 12) : 0;
    geometry.icon_h = show_icon ? icon_px + 6 : 0;
    if (show_icon) {
      if (center_aligned) {
        geometry.icon_x = (card_w - geometry.icon_w) / 2;
      } else if (end_aligned) {
        geometry.icon_x = card_w - padding - geometry.icon_w;
      } else {
        geometry.icon_x = padding;
      }
    }
    const int block_y = padding + std::max(0, (available_h - needed_h) / 2);
    geometry.icon_y = block_y;

    geometry.label_w = std::max(8, card_w - padding * 2);
    geometry.label_h = show_label ? label_px + 6 : 0;
    geometry.label_x = padding;
    geometry.label_y = geometry.icon_y + (show_icon ? geometry.icon_h + stack_gap : 0);

    geometry.value_w = std::max(8, card_w - padding * 2);
    geometry.value_x = padding;
    geometry.value_y = geometry.label_y + (show_label ? geometry.label_h + stack_gap : 0);
    geometry.value_h = std::max(show_value ? value_px + 6 : 0, card_h - geometry.value_y - padding);
    geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 0);
    return geometry;
  }

  const int base_icon_px = esp_panel_clamp_int(card_h - padding * 2 - (grid_h > 1 ? 18 : 12), 22, 52);
  const int icon_px = esp_panel_scale_px(base_icon_px, icon_scale, 18, 64);
  const int label_px = esp_panel_scale_px(card_h / 6, label_scale, 10, wide ? 22 : 18);
  const int value_px = esp_panel_scale_px(auto_value ? card_h / 2 : card_h / 3, value_scale, 14, wide ? 40 : 32);
  const int icon_w = show_icon ? std::min(icon_px + 12, std::max(28, card_w / 3)) : 0;
  const int icon_h = show_icon ? icon_px + 8 : 0;
  const int text_gap = gap + 2;
  const int text_w = std::max(24, card_w - padding * 2 - (show_icon ? icon_w + text_gap : 0));
  const int label_h = show_label ? label_px + 8 : 0;
  const int text_block_h = label_h + (show_label && show_value ? gap : 0) + (show_value ? value_px + 8 : 0);
  const int content_h = std::max(icon_h, text_block_h);
  const int content_y = padding + std::max(0, (std::max(24, card_h - padding * 2) - content_h) / 2);
  const int text_y = content_y + std::max(0, (content_h - text_block_h) / 2);

  geometry.icon_px = icon_px;
  geometry.label_px = label_px;
  geometry.value_px = value_px;
  geometry.icon_w = icon_w;
  geometry.icon_h = icon_h;
  geometry.icon_y = show_icon ? content_y + std::max(0, (content_h - geometry.icon_h) / 2) : 0;
  geometry.icon_x = show_icon ? (icon_right ? card_w - padding - icon_w : padding) : 0;
  geometry.label_x = icon_right ? padding : padding + (show_icon ? icon_w + text_gap : 0);
  geometry.label_y = text_y;
  geometry.label_w = text_w;
  geometry.label_h = label_h;
  geometry.value_x = geometry.label_x;
  geometry.value_y = geometry.label_y + (show_label ? geometry.label_h + gap : 0);
  geometry.value_w = text_w;
  geometry.value_h = std::max(value_px + 8, card_h - geometry.value_y - padding);
  geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 0);
  return geometry;
}

static inline EspPanelWidgetGeometry esp_panel_widget_geometry(
    int grid_w, int grid_h, const std::string &align, const std::string &layout_mode, const std::string &type_name, int icon_scale, int label_scale, int value_scale) {
  return esp_panel_widget_geometry(grid_w, grid_h, align, layout_mode, type_name, icon_scale, label_scale, value_scale, true, true, true);
}

static inline EspPanelTextBounds esp_panel_text_bounds(int area_x, int area_w, int align_code, const std::string &text, int font_px) {
  EspPanelTextBounds bounds{};
  bounds.x = area_x;
  bounds.w = std::max(8, area_w);

  if (align_code == 0) {
    return bounds;
  }

  const int estimated_width = std::min(std::max(8, area_w), esp_panel_estimate_text_width(text, font_px));
  bounds.w = estimated_width;

  if (align_code == 1) {
    bounds.x = area_x + std::max(0, (area_w - estimated_width) / 2);
  } else if (align_code == 2) {
    bounds.x = area_x + std::max(0, area_w - estimated_width);
  }

  return bounds;
}

static inline int esp_panel_widget_text_align_code(
    int grid_w, int grid_h, const std::string &align, const std::string &layout_mode, const std::string &type_name, int icon_scale, int label_scale, int value_scale) {
  return esp_panel_widget_geometry(grid_w, grid_h, align, layout_mode, type_name, icon_scale, label_scale, value_scale).text_align_code;
}
