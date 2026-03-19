import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FilterState {
  colors: string[];
  sizes: string[];
  fabric: string;
  priceRange: [number, number];
  sortBy: string;
  inStockOnly: boolean;
}

interface ProductFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableColors: string[];
  availableSizes: string[];
  availableFabrics: string[];
  maxPrice: number;
  totalProducts: number;
}

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name", label: "Name: A to Z" },
];

const FilterSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border/30 py-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
        <span className="text-xs tracking-widest text-foreground">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-foreground/50 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
};

const FiltersContent = ({
  filters,
  onFiltersChange,
  availableColors,
  availableSizes,
  availableFabrics,
  maxPrice,
}: Omit<ProductFiltersProps, "totalProducts">) => {
  const toggleColor = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    onFiltersChange({ ...filters, colors: newColors });
  };

  const toggleSize = (size: string) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onFiltersChange({ ...filters, sizes: newSizes });
  };

  return (
    <div className="space-y-0">
      {/* Sort */}
      <FilterSection title="SORT BY">
        <RadioGroup
          value={filters.sortBy}
          onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}
          className="space-y-2"
        >
          {sortOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
              <RadioGroupItem value={option.value} id={`sort-${option.value}`} />
              <span className="text-sm text-foreground/70 group-hover:text-foreground">
                {option.label}
              </span>
            </label>
          ))}
        </RadioGroup>
      </FilterSection>

      {/* Availability */}
      <FilterSection title="AVAILABILITY">
        <div className="flex items-center gap-3">
          <Switch
            checked={filters.inStockOnly}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, inStockOnly: checked })}
          />
          <Label className="text-sm text-foreground/70">In stock only</Label>
        </div>
      </FilterSection>

      {/* Fabric */}
      {availableFabrics.length > 0 && (
        <FilterSection title="FABRIC">
          <RadioGroup
            value={filters.fabric || "__all__"}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, fabric: value === "__all__" ? "" : value })
            }
            className="space-y-2"
          >
            <label className="flex items-center gap-3 cursor-pointer group">
              <RadioGroupItem value="__all__" id="fabric-all" />
              <span className="text-sm text-foreground/70 group-hover:text-foreground">All</span>
            </label>
            {availableFabrics.map((fab) => (
              <label key={fab} className="flex items-center gap-3 cursor-pointer group">
                <RadioGroupItem value={fab} id={`fabric-${fab}`} />
                <span className="text-sm text-foreground/70 group-hover:text-foreground">{fab}</span>
              </label>
            ))}
          </RadioGroup>
        </FilterSection>
      )}

      {/* Colors */}
      {availableColors.length > 0 && (
        <FilterSection title="COLOR">
          <div className="flex flex-wrap gap-2">
            {availableColors.map((color) => (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  filters.colors.includes(color)
                    ? "border-foreground scale-110"
                    : "border-border/50 hover:border-foreground/50"
                )}
                style={{ backgroundColor: color.toLowerCase() }}
                title={color}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Sizes */}
      {availableSizes.length > 0 && (
        <FilterSection title="SIZE">
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={cn(
                  "px-3 py-1.5 text-xs border transition-colors",
                  filters.sizes.includes(size)
                    ? "bg-foreground text-background border-foreground"
                    : "border-border/50 text-foreground/70 hover:border-foreground"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Price Range */}
      <FilterSection title="PRICE RANGE">
        <div className="px-2">
          <Slider
            value={filters.priceRange}
            min={0}
            max={maxPrice}
            step={100}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, priceRange: value as [number, number] })
            }
            className="mt-2"
          />
          <div className="flex justify-between mt-3 text-xs text-foreground/60">
            <span>₹{filters.priceRange[0].toLocaleString("en-IN")}</span>
            <span>₹{filters.priceRange[1].toLocaleString("en-IN")}</span>
          </div>
        </div>
      </FilterSection>
    </div>
  );
};

const ProductFilters = (props: ProductFiltersProps) => {
  const { filters, onFiltersChange, totalProducts } = props;

  const activeFilterCount =
    filters.colors.length +
    filters.sizes.length +
    (filters.fabric ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < props.maxPrice ? 1 : 0);

  const clearFilters = () => {
    onFiltersChange({
      colors: [],
      sizes: [],
      fabric: "",
      priceRange: [0, props.maxPrice],
      sortBy: "newest",
      inStockOnly: false,
    });
  };

  return (
    <>
      {/* Desktop Filters */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-32">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs tracking-widest text-foreground">FILTER ({totalProducts})</h2>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-foreground/50 hover:text-foreground underline">
                Clear all
              </button>
            )}
          </div>
          <FiltersContent {...props} />
        </div>
      </aside>

      {/* Mobile Filters */}
      <div className="lg:hidden flex items-center justify-between mb-6">
        <p className="text-xs text-foreground/60">{totalProducts} products</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filter & Sort
              {activeFilterCount > 0 && (
                <span className="bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Filter & Sort</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs font-normal text-foreground/50 hover:text-foreground">
                    Clear all
                  </button>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FiltersContent {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default ProductFilters;
