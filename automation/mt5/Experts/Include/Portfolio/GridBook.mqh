/*-----------------------------------------------
  Grid book placeholder
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_GRID_BOOK_MQH__
#define __LIMNI_PORTFOLIO_GRID_BOOK_MQH__

class LP_GridBook
{
private:
   int m_open_grid_count;

public:
   void Reset()
   {
      m_open_grid_count = 0;
   }

   int OpenGridCount()
   {
      return m_open_grid_count;
   }
};

#endif // __LIMNI_PORTFOLIO_GRID_BOOK_MQH__
