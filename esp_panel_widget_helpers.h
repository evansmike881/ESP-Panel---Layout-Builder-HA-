#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <string>

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

static inline int esp_panel_clamp_int(int value, int min_value, int max_value) {
  return std::max(min_value, std::min(max_value, value));
}

static inline int esp_panel_scale_px(int base_px, int percent, int min_px, int max_px) {
  return esp_panel_clamp_int((base_px * percent + 50) / 100, min_px, max_px);
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
    int grid_w, int grid_h, const std::string &align, const std::string &layout_mode, const std::string &type_name, int icon_scale, int label_scale, int value_scale) {
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

  if (stacked) {
    const int icon_px = esp_panel_scale_px(tall ? min_side / 2 : min_side / 3, icon_scale, 18, 64);
    const int label_px = esp_panel_scale_px(tall ? 16 : 12, label_scale, 10, 28);
    const int value_px = esp_panel_scale_px(auto_value ? card_h / 4 : card_h / 5, value_scale, 14, 40);

    geometry.icon_px = icon_px;
    geometry.label_px = label_px;
    geometry.value_px = value_px;

    geometry.icon_w = std::min(card_w - padding * 2, icon_px + 12);
    geometry.icon_h = icon_px + 8;
    if (center_aligned) {
      geometry.icon_x = (card_w - geometry.icon_w) / 2;
    } else if (end_aligned) {
      geometry.icon_x = card_w - padding - geometry.icon_w;
    } else {
      geometry.icon_x = padding;
    }
    geometry.icon_y = padding;

    geometry.label_w = std::max(8, card_w - padding * 2);
    geometry.label_h = label_px + 8;
    geometry.label_x = padding;
    geometry.label_y = geometry.icon_y + geometry.icon_h + gap;

    geometry.value_w = std::max(8, card_w - padding * 2);
    geometry.value_x = padding;
    geometry.value_y = geometry.label_y + geometry.label_h + gap;
    geometry.value_h = std::max(value_px + 8, card_h - geometry.value_y - padding);
    geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 0);
    return geometry;
  }

  const int base_icon_px = esp_panel_clamp_int(card_h - padding * 2 - (grid_h > 1 ? 18 : 12), 22, 52);
  const int icon_px = esp_panel_scale_px(base_icon_px, icon_scale, 18, 64);
  const int label_px = esp_panel_scale_px(card_h / 6, label_scale, 10, wide ? 22 : 18);
  const int value_px = esp_panel_scale_px(auto_value ? card_h / 2 : card_h / 3, value_scale, 14, wide ? 40 : 32);
  const int icon_w = std::min(icon_px + 12, std::max(28, card_w / 3));
  const int text_gap = gap + 2;
  const int text_w = std::max(24, card_w - padding * 2 - icon_w - text_gap);

  geometry.icon_px = icon_px;
  geometry.label_px = label_px;
  geometry.value_px = value_px;
  geometry.icon_w = icon_w;
  geometry.icon_h = icon_px + 8;
  geometry.icon_y = (card_h - geometry.icon_h) / 2;
  geometry.icon_x = icon_right ? card_w - padding - icon_w : padding;
  geometry.label_x = icon_right ? padding : padding + icon_w + text_gap;
  geometry.label_y = padding + (grid_h > 1 ? 10 : 2);
  geometry.label_w = text_w;
  geometry.label_h = label_px + 8;
  geometry.value_x = geometry.label_x;
  geometry.value_y = geometry.label_y + geometry.label_h + gap;
  geometry.value_w = text_w;
  geometry.value_h = std::max(value_px + 8, card_h - geometry.value_y - padding);
  geometry.text_align_code = center_aligned ? 1 : (end_aligned ? 2 : 0);
  return geometry;
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
