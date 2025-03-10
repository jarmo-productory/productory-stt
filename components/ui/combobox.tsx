"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ComboboxOption = {
  value: string
  label: string
  disabled?: boolean
  extra?: string // For displaying additional info like native language name
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  clearable?: boolean
  searchPlaceholder?: string
  className?: string
  groupedOptions?: { [key: string]: ComboboxOption[] }
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  emptyMessage = "No results found.",
  clearable = true,
  searchPlaceholder = "Search...",
  className,
  groupedOptions,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Find the selected option for display
  const selectedOption = React.useMemo(() => {
    if (!value) return undefined
    
    if (groupedOptions) {
      for (const group of Object.values(groupedOptions)) {
        const found = group.find(option => option.value === value)
        if (found) return found
      }
    }
    
    return options.find(option => option.value === value)
  }, [value, options, groupedOptions])

  // Handle clearing the selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
  }

  // Handle selecting an option
  const handleSelect = (currentValue: string) => {
    onChange(currentValue)
    setOpen(false)
    setSearchQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? (
            <div className="flex items-center justify-between w-full">
              <span>{selectedOption.label}</span>
              {selectedOption.extra && (
                <span className="text-sm text-muted-foreground ml-2">
                  {selectedOption.extra}
                </span>
              )}
              {clearable && value && (
                <X
                  className="ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[200px]">
        <Command filter={(value, search) => {
          // Custom filter function that searches in label, value, and extra
          if (!search) return 1
          
          const searchLower = search.toLowerCase()
          const valueLower = value.toLowerCase()
          
          // Check if the search term is in the value
          if (valueLower.includes(searchLower)) return 1
          
          // Find the option to check label and extra
          const option = options.find(opt => opt.value.toLowerCase() === valueLower)
          if (!option) return 0
          
          // Check if search term is in label or extra
          if (option.label.toLowerCase().includes(searchLower)) return 1
          if (option.extra && option.extra.toLowerCase().includes(searchLower)) return 1
          
          return 0
        }}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groupedOptions ? (
              Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                <CommandGroup key={groupName} heading={groupName}>
                  {groupOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.extra && (
                          <span className="text-xs text-muted-foreground">
                            {option.extra}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.extra && (
                        <span className="text-xs text-muted-foreground">
                          {option.extra}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 