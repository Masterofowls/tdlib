import React, { useState, useRef, useEffect } from "react";

export const OTPField = {
  Root: ({ children, length, onValueComplete, className }) => {
    const [values, setValues] = useState(new Array(length).fill(""));
    const inputRefs = useRef([]);

    useEffect(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }, []);

    const handleChange = (index, value) => {
      if (isNaN(value)) return;

      const newValues = [...values];
      newValues[index] = value.slice(-1);
      setValues(newValues);

      const joinedValue = newValues.join("");

      if (joinedValue.length === length && onValueComplete) {
        onValueComplete(joinedValue);
      }

      if (value && index < length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    };

    const handleKeyDown = (index, e) => {
      if (e.key === "Backspace" && !values[index] && index > 0) {
        inputRefs.current[index - 1].focus();
      }
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData("text/plain").slice(0, length);

      if (pastedData && !isNaN(pastedData)) {
        const pastedArray = pastedData.split("");
        const newValues = [...values];

        for (let i = 0; i < Math.min(pastedArray.length, length); i++) {
          newValues[i] = pastedArray[i];
        }

        setValues(newValues);
        const joinedValue = newValues.join("");

        if (joinedValue.length === length && onValueComplete) {
          onValueComplete(joinedValue);
        }

        const lastFilledIndex = Math.min(pastedArray.length, length) - 1;
        if (inputRefs.current[lastFilledIndex]) {
          inputRefs.current[lastFilledIndex].focus();
        }
      }
    };

    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === OTPField.Group) {
        return React.cloneElement(child, {
          inputRefs,
          values,
          handleChange,
          handleKeyDown,
          handlePaste,
          length,
        });
      }
      return child;
    });

    return <div className={className}>{childrenWithProps}</div>;
  },

  Group: ({
    children,
    inputRefs,
    values,
    handleChange,
    handleKeyDown,
    handlePaste,
    length,
    className,
  }) => {
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === OTPField.Input) {
        const index = child.props.index;
        return React.cloneElement(child, {
          ref: (el) => {
            if (inputRefs.current) inputRefs.current[index] = el;
          },
          value: values[index],
          onChange: (e) => handleChange(index, e.target.value),
          onKeyDown: (e) => handleKeyDown(index, e),
          onPaste: handlePaste,
        });
      }
      return child;
    });

    return <div className={className}>{childrenWithProps}</div>;
  },

  Input: React.forwardRef(
    (
      {
        className,
        disabled,
        index,
        value,
        onChange,
        onKeyDown,
        onPaste,
        ...props
      },
      ref,
    ) => {
      return (
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value || ""}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          disabled={disabled}
          className={className}
          {...props}
        />
      );
    },
  ),
};
