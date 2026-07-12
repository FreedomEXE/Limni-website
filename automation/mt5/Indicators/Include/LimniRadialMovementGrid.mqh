//+------------------------------------------------------------------+
//|                         LimniRadialMovementGrid.mqh              |
//|                         Pure movement geometry helpers           |
//+------------------------------------------------------------------+
#ifndef LIMNI_RADIAL_MOVEMENT_GRID_MQH
#define LIMNI_RADIAL_MOVEMENT_GRID_MQH

struct LimniRadialMap
{
   bool     valid;
   bool     bootstrap;
   int      start_index;
   int      end_index;
   datetime start_time;
   datetime end_time;
   double   center;
   double   radius;
   double   movement;
};

void LimniInitMap(LimniRadialMap &map)
{
   map.valid = false;
   map.bootstrap = true;
   map.start_index = -1;
   map.end_index = -1;
   map.start_time = 0;
   map.end_time = 0;
   map.center = 0.0;
   map.radius = 0.0;
   map.movement = 0.0;
}

double LimniSegmentMovement(const double a, const double b)
{
   return MathAbs(b - a);
}

double LimniPathMovement(const double &price[], const int start_index, const int end_index)
{
   if(end_index <= start_index)
      return 0.0;

   double movement = 0.0;
   for(int i = start_index + 1; i <= end_index; i++)
      movement += LimniSegmentMovement(price[i - 1], price[i]);

   return movement;
}

double LimniPathBelowPrice(const double &price[], const int start_index, const int end_index, const double probe)
{
   if(end_index <= start_index)
      return 0.0;

   double below = 0.0;
   for(int i = start_index + 1; i <= end_index; i++)
   {
      double a = price[i - 1];
      double b = price[i];
      double lo = MathMin(a, b);
      double hi = MathMax(a, b);
      double span = hi - lo;

      if(span <= 0.0)
         continue;

      if(probe >= hi)
         below += span;
      else if(probe > lo)
         below += probe - lo;
   }

   return below;
}

bool LimniPathBounds(
   const double &price[],
   const int start_index,
   const int end_index,
   double &min_price,
   double &max_price
)
{
   if(end_index < start_index)
      return false;

   min_price = price[start_index];
   max_price = price[start_index];

   for(int i = start_index; i <= end_index; i++)
   {
      if(price[i] < min_price)
         min_price = price[i];
      if(price[i] > max_price)
         max_price = price[i];
   }

   return max_price > min_price;
}

double LimniMovementMedian(const double &price[], const int start_index, const int end_index, const double total_movement)
{
   double lo = 0.0;
   double hi = 0.0;
   if(!LimniPathBounds(price, start_index, end_index, lo, hi))
      return price[start_index];

   double half = total_movement / 2.0;

   // Numerical solve for the median under movement measure d|p|.
   for(int iter = 0; iter < 64; iter++)
   {
      double mid = (lo + hi) / 2.0;
      double below = LimniPathBelowPrice(price, start_index, end_index, mid);

      if(below >= half)
         hi = mid;
      else
         lo = mid;
   }

   return (lo + hi) / 2.0;
}

double LimniMovementRadius(
   const double &price[],
   const int start_index,
   const int end_index,
   const double center,
   const double total_movement
)
{
   if(total_movement <= 0.0 || end_index <= start_index)
      return 0.0;

   double integral = 0.0;

   for(int i = start_index + 1; i <= end_index; i++)
   {
      double a = price[i - 1];
      double b = price[i];
      double lo = MathMin(a, b);
      double hi = MathMax(a, b);

      if(hi <= lo)
         continue;

      double u = hi - center;
      double v = lo - center;
      integral += (u * u * u - v * v * v) / 3.0;
   }

   if(integral <= 0.0)
      return 0.0;

   return MathSqrt(integral / total_movement);
}

bool LimniComputeMovementMap(
   const datetime &time[],
   const double &price[],
   const int start_index,
   const int end_index,
   const bool bootstrap,
   LimniRadialMap &map
)
{
   LimniInitMap(map);

   if(start_index < 0 || end_index <= start_index)
      return false;

   double movement = LimniPathMovement(price, start_index, end_index);
   if(movement <= 0.0)
      return false;

   double center = LimniMovementMedian(price, start_index, end_index, movement);
   double radius = LimniMovementRadius(price, start_index, end_index, center, movement);
   if(radius <= 0.0 || !MathIsValidNumber(radius))
      return false;

   map.valid = true;
   map.bootstrap = bootstrap;
   map.start_index = start_index;
   map.end_index = end_index;
   map.start_time = time[start_index];
   map.end_time = time[end_index];
   map.center = center;
   map.radius = radius;
   map.movement = movement;

   return true;
}

double LimniZ(const double price, const LimniRadialMap &map)
{
   if(!map.valid || map.radius <= 0.0)
      return 0.0;

   return (price - map.center) / map.radius;
}

bool LimniCrossedCenter(const double previous_z, const double current_z)
{
   return (previous_z < 0.0 && current_z >= 0.0) ||
      (previous_z > 0.0 && current_z <= 0.0);
}

#endif
