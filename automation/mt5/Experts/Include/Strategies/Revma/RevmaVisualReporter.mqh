/*-----------------------------------------------
  Revma visual dashboard rendering
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_VISUAL_REPORTER_MQH__
#define __LIMNI_PORTFOLIO_REVMA_VISUAL_REPORTER_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\..\\Core\\Config.mqh"
#include "..\\..\\Receipts\\ReceiptWriter.mqh"

class LP_RevmaVisualReporter
{
private:
   datetime m_last_update;
   string m_last_text;
   bool m_screenshot_captured;

   void DeleteObjectIfExists(const string name)
   {
      if(ObjectFind(0, name) >= 0)
         ObjectDelete(0, name);
   }

   void CleanupLegacyDashboardObjects()
   {
      for(int i = ObjectsTotal(0, -1, OBJ_LABEL) - 1; i >= 0; i--)
      {
         string name = ObjectName(0, i, -1, OBJ_LABEL);
         if(name == "")
            continue;
         string text = ObjectGetString(0, name, OBJPROP_TEXT);
         if(StringFind(name, "Label") == 0 && text == "Label")
            ObjectDelete(0, name);
      }
   }

   void DrawDashboardText(const string text)
   {
      string lines[];
      int count = StringSplit(text, '\n', lines);
      int max_render_lines = 30;
      int cleanup_lines = 80;
      int x = 18;
      int y = 44;
      int line_height = 17;
      CleanupLegacyDashboardObjects();
      for(int i = 0; i < cleanup_lines; i++)
      {
         string name = "Limni_RevmaDash_Line_" + IntegerToString(i);
         if(i >= max_render_lines || i >= count || lines[i] == "")
         {
            DeleteObjectIfExists(name);
            continue;
         }
         if(ObjectFind(0, name) < 0)
            ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
         ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y + i * line_height);
         ObjectSetInteger(0, name, OBJPROP_COLOR, i == 0 ? C'87,194,255' : clrWhite);
         ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
         ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
         ObjectSetString(0, name, OBJPROP_TEXT, lines[i]);
         ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
         ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
         ObjectSetInteger(0, name, OBJPROP_ZORDER, 50);
      }
   }

   void DrawCenterline(const double centerline_price)
   {
      string name = "Limni_Revma_Centerline";
      if(centerline_price <= 0.0 || !MathIsValidNumber(centerline_price))
      {
         DeleteObjectIfExists(name);
         return;
      }

      if(ObjectFind(0, name) < 0)
         ObjectCreate(0, name, OBJ_HLINE, 0, 0, centerline_price);
      ObjectSetDouble(0, name, OBJPROP_PRICE, centerline_price);
      ObjectSetInteger(0, name, OBJPROP_COLOR, C'87,194,255');
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_ZORDER, 20);
      ObjectSetString(0, name, OBJPROP_TEXT, "REVMA CENTER");
   }

   void CaptureDashboardScreenshot(
      const LP_Config &config,
      LP_ReceiptWriter &receipts,
      const string dashboard_text
   )
   {
      string stamp = LP_SafePart(LP_Stamp(TimeCurrent()) + "_" + IntegerToString((int)TimeLocal()));
      int file_scope = config.export_to_common_files ? FILE_COMMON : 0;
      FolderCreate(config.output_folder, file_scope);
      string dashboard_text_file = config.output_folder + "\\revma_dashboard_snapshot_" + stamp + ".txt";
      bool dashboard_text_ok = false;
      int handle = FileOpen(dashboard_text_file, FILE_WRITE | FILE_TXT | FILE_ANSI | file_scope);
      if(handle != INVALID_HANDLE)
      {
         FileWriteString(handle, dashboard_text);
         FileClose(handle);
         dashboard_text_ok = true;
      }

      string file = "Gate99ZZA_revma_divergent_add_dashboard_" + stamp + ".png";
      bool ok = ChartScreenShot(0, file, 1600, 900, ALIGN_RIGHT);
      receipts.Summary("revma_dashboard_screenshot", (ok ? "ok:" : "failed:") + file);
      receipts.Summary("revma_dashboard_snapshot", (dashboard_text_ok ? "ok:" : "failed:") + dashboard_text_file);
      receipts.Write(
         LP_RECEIPT_REVMA_GRID_ADD,
         "",
         ok ? "dashboard_screenshot" : "dashboard_screenshot_failed",
         "file=" + file +
            "|ok=" + LP_BoolText(ok) +
            "|dashboard_text_file=" + dashboard_text_file +
            "|dashboard_text_ok=" + LP_BoolText(dashboard_text_ok) +
            "|terminal_data_path=" + TerminalInfoString(TERMINAL_DATA_PATH),
         LP_LANE_REVMA,
         0,
         0,
         0,
         0,
         0
      );
      receipts.Flush();
   }

public:
   void Reset()
   {
      m_last_update = 0;
      m_last_text = "";
      m_screenshot_captured = false;
      DeleteObjectIfExists("Limni_Revma_Centerline");
      for(int i = 0; i < 80; i++)
         DeleteObjectIfExists("Limni_RevmaDash_Line_" + IntegerToString(i));
   }

   bool UpdateRequired(
      const LP_Config &config,
      const string text,
      const bool force
   )
   {
      if(!config.revma_show_visual_dashboard)
         return false;
      if(text == "")
         return false;

      datetime now = TimeCurrent();
      int refresh_seconds = MathMax(0, config.revma_dashboard_refresh_seconds);
      if(!force && refresh_seconds > 0 && m_last_update > 0 &&
         now - m_last_update < refresh_seconds &&
         text == m_last_text)
      {
         return false;
      }
      return true;
   }

   void Update(
      const LP_Config &config,
      const string text,
      const double centerline_price,
      const bool screenshot_requested,
      LP_ReceiptWriter &receipts
   )
   {
      Comment("");
      DrawDashboardText(text);
      DrawCenterline(centerline_price);
      ChartRedraw(0);
      if(config.revma_dashboard_screenshot_on_divergent_add &&
         !m_screenshot_captured &&
         screenshot_requested)
      {
         m_screenshot_captured = true;
         CaptureDashboardScreenshot(config, receipts, text);
      }
      m_last_update = TimeCurrent();
      m_last_text = text;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_VISUAL_REPORTER_MQH__
