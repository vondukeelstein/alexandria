function renderGDPLineChart() {
  const dataUrl = "GDP-Data Set.csv";
  const formats = {
    "USD - trillion or hundred billion": {
      tick: d3.format("$~s"),
      value: d3.format("$~s"),
    },
    Perecent: {
      tick: (d) => `${d3.format(".0f")(d)}%`,
      value: (d) => `${d3.format(".1f")(d)}%`,
    },
  };
  const dispatch = d3.dispatch("namechange", "measurechange", "yearchange");
  let chart, nameControl, measureControl, yearControl;
  init();
  return { destroy };

  function destroy() {
    dispatch.on("namechange", null);
    dispatch.on("measurechange", null);
    dispatch.on("yearchange", null);
    chart.destroy();
    nameControl.destroy();
    measureControl.destroy();
    yearControl.destroy();
  }

  function init() {
    d3.csv(dataUrl, d3.autoType).then((csv) => {
      // Process data
      const years = csv.columns.slice(6);
      const measures = [...new Set(csv.map((d) => d.Measure))];
      const names = [...new Set(csv.map((d) => d.Name))];
      const transformed = csv.map((d) => ({
        name: d.Name,
        measure: d.Measure,
        unit: d["Display Units"],
        color: d["Line Color Hex Code"],
        values: years.map((year) => ({ x: +year, y: d[year] })),
      }));
      const grouped = d3.group(
        transformed,
        (d) => d.measure,
        (d) => d.name
      );

      // Containers
      const container = d3
        .select(".gdp-line-chart")
        .classed("container-fluid", true)
        .append("div")
        .attr("class", "row py-3")
        .call((row) =>
          row.append("div").attr("class", "chart-container col-12")
        )
        .call((row) =>
          row.append("div").attr("class", "measure-control col-12")
        )
        .call((row) => row.append("div").attr("class", "name-control col-12"))
        .call((row) => row.append("div").attr("class", "year-control col-12"));

      // Initialization
      const selected = {
        names: names.slice(),
        measure: measures[0],
        years: [+years[0], +years[years.length - 1]],
      };

      chart = renderGDPLineChart(
        container.select(".chart-container"),
        grouped,
        formats
      );
      chart.update(selected);
      nameControl = renderNameControl(
        container.select(".measure-control"),
        dispatch,
        names,
        selected.names
      );
      measureControl = renderMeasureControl(
        container.select(".name-control"),
        dispatch,
        measures,
        selected.measure
      );
      yearControl = renderYearControl(
        container.select(".year-control"),
        dispatch,
        [+years[0], +years[years.length - 1]],
        selected.years
      );

      // Dispatch
      dispatch.on("namechange", function (name, isSelecting) {
        if (isSelecting) {
          selected.names = names.filter((d) =>
            [...selected.names, name].includes(d)
          );
        } else {
          selected.names = selected.names.filter((d) => d !== name);
        }
        chart.update(selected);
      });

      dispatch.on("measurechange", function (measure) {
        selected.measure = measure;
        chart.update(selected);
      });

      dispatch.on("yearchange", function (yearRange) {
        selected.years = yearRange;
        chart.update(selected);
      });
    });
  }

  function renderGDPLineChart(container, data, formats) {
    const margin = { top: 20, right: 100, bottom: 30, left: 50 };
    const height = 420;
    const lineWidth = 1;
    const circleRadius = 3;
    let width, label, formatTick, formatValue;

    const x = d3.scaleLinear();
    const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
    const line = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    const svg = container.append("svg").style("width", "100%");
    const gXAxis = svg.append("g");
    const gYAxis = svg.append("g");
    const gLines = svg.append("g");
    const gLabels = svg.append("g");

    const tooltip = container.append("div").attr("class", "chart-tooltip");
    function showTooltip(d) {
      const p = d3.select(this.parentNode).datum();
      tooltip.html(`
        <div>${p.name}</div>
        <div>${p.measure}</div>
        <div>${d.x}</div> 
        <div>${formatValue(d.y)}</div>
      `);

      const circleBox = this.getBoundingClientRect();
      const tooltipBox = tooltip.node().getBoundingClientRect();
      const containerBox = container.node().getBoundingClientRect();
      let left =
        (circleBox.left + circleBox.right) / 2 -
        tooltipBox.width / 2 -
        containerBox.left;
      if (left < 0) {
        left = 0;
      }
      if (left + tooltipBox.width > containerBox.width) {
        left = containerBox.width - tooltipBox.width;
      }
      let top = circleBox.top - 5 - tooltipBox.height - containerBox.top;
      if (top < containerBox.top) {
        top = circleBox.bottom + 5 - containerBox.top;
      }
      tooltip.style("transform", `translate(${left}px,${top}px)`);

      tooltip.transition().style("opacity", 1);
      d3.select(this)
        .transition()
        .attr("r", circleRadius * 2);
    }

    function hideTooltip() {
      tooltip.transition().style("opacity", 0);
      d3.select(this)
        .transition()
        .attr("r", circleRadius * 1);
    }

    window.addEventListener("resize", resize);
    function resize() {
      width = svg.node().clientWidth;
      svg.attr("viewBox", [0, 0, width, height]);
      x.range([margin.left, width - margin.right]);

      gXAxis.call(xAxis);
      gYAxis.call(yAxis);

      gLines
        .call((g) => g.selectAll(".series-path").attr("d", line))
        .call((g) =>
          g
            .selectAll(".series-circle")
            .attr("cx", (d) => x(d.x))
            .attr("cy", (d) => y(d.y))
        );

      gLabels
        .selectAll(".series-label")
        .attr("x", width - margin.right)
        .attr("y", (d) => y(d.values[d.values.length - 1].y));
    }

    function update(selected) {
      const measureData = data.get(selected.measure);
      const namesData = selected.names.map((name) => measureData.get(name)[0]);
      const filtered = namesData.map((d) => ({
        ...d,
        values: d.values.filter(
          (e) => e.x >= selected.years[0] && e.x <= selected.years[1]
        ),
      }));
      label = selected.measure;
      const format = filtered.length
        ? formats[filtered[0].unit]
        : { tick: (d) => d, value: (d) => d };
      formatTick = format.tick;
      formatValue = format.value;

      const maxValue = d3.max(filtered, (d) => d3.max(d.values, (d) => d.y));
      const minValue = d3.min(filtered, (d) => d3.min(d.values, (d) => d.y));
      x.domain(selected.years).nice();
      y.domain([minValue, maxValue]).nice();

      gLines
        .selectAll(".series")
        .data(filtered, (d) => d.name)
        .join((enter) =>
          enter
            .append("g")
            .attr("class", "series")
            .call((g) =>
              g
                .append("path")
                .attr("class", "series-path")
                .attr("fill", "none")
                .attr("stroke", (d) => d.color)
                .attr("stroke-width", lineWidth)
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
            )
        )
        .call((g) => g.select(".series-path").datum((d) => d.values))
        .call((g) =>
          g
            .selectAll("circle")
            .data(
              (d) => d.values,
              (d) => d.x
            )
            .join("circle")
            .attr("class", "series-circle")
            .attr("r", circleRadius)
            .attr("fill", function () {
              return d3.select(this.parentNode).datum().color;
            })
            .on("mouseenter", showTooltip)
            .on("mouseleave", hideTooltip)
        );

      gLabels
        .selectAll(".series-label")
        .data(filtered, (d) => d.name)
        .join((enter) =>
          enter
            .append("text")
            .attr("class", "series-label")
            .attr("fill", (d) => d.color)
            .attr("dy", "0.32em")
            .attr("dx", circleRadius + 4)
            .text((d) => d.name)
        );

      resize();
    }

    function xAxis(g) {
      g.selectAll(".tick .grid").remove();
      g.selectAll(".axis-label").remove();
      g.attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 80, "d"))
        .call((g) => g.select(".domain").remove())
        .call((g) =>
          g
            .selectAll(".tick line")
            .clone()
            .classed("grid", true)
            .attr("y2", -height + margin.top + margin.bottom)
            .attr("stroke-opacity", 0.1)
        )
        .call((g) =>
          g
            .append("text")
            .attr("class", "axis-label")
            .attr("x", width - margin.right)
            .attr("y", -4)
            .attr("font-weight", "bold")
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .text("year")
            .call(halo)
        );
    }

    function yAxis(g) {
      g.selectAll(".tick .grid").remove();
      g.selectAll(".axis-label").remove();
      g.attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(formatTick))
        .call((g) => g.select(".domain").remove())
        .call((g) =>
          g
            .selectAll(".tick line")
            .clone()
            .classed("grid", true)
            .attr("x2", width - margin.left - margin.right)
            .attr("stroke-opacity", 0.1)
        )
        .call((g) =>
          g
            .select(".tick:last-of-type text")
            .clone()
            .attr("class", "axis-label")
            .attr("x", 4)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("fill", "black")
            .text(label)
            .call(halo)
        );
    }

    function halo(text) {
      text
        .select(function () {
          return this.parentNode.insertBefore(this.cloneNode(true), this);
        })
        .attr("class", "axis-label")
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round");
    }

    function destroy() {
      container.selectAll("*").remove();
      window.removeEventListener("resize", resize);
    }
    return { update, destroy };
  }

  function renderNameControl(container, dispatch, names, selectedNames) {
    container
      .append("div")
      .attr("class", "form-group")
      .call((div) => div.append("label").text("Regions/Countries"))
      .call((div) =>
        div
          .append("div")
          .attr("class", "btn-group-toggle")
          .attr("data-toggle", "buttons")
          .selectAll("label")
          .data(names)
          .join("label")
          .attr("class", "btn btn-sm btn-outline-secondary")
          .classed("active", (d) => selectedNames.includes(d))
          .call((label) =>
            label
              .append("input")
              .attr("type", "checkbox")
              .attr("checked", (d) =>
                selectedNames.includes(d) ? "checked" : null
              )
              .on("change", function (d) {
                const label = d3.select(this.parentNode);
                label.classed("active", this.checked);
                label
                  .select("i")
                  .classed("fa-check-circle-o", this.checked)
                  .classed("fa-circle-o", !this.checked);
                dispatch.call("namechange", null, d, this.checked);
              })
          )
          .call((label) =>
            label.append("i").attr("class", "fa fa-check-circle-o pr-1")
          )
          .call((label) => label.append("span").text((d) => d))
      );

    function destroy() {
      container.selectAll("*").remove();
    }
    return { destroy };
  }

  function renderMeasureControl(
    container,
    dispatch,
    measures,
    selectedMeasure
  ) {
    container
      .append("div")
      .attr("class", "form-group")
      .call((div) => div.append("label").text("Metric"))
      .call((div) =>
        div
          .append("div")
          .append("select")
          .attr("class", "custom-select custom-select-sm")
          .on("change", function () {
            dispatch.call("measurechange", null, this.value);
          })
          .selectAll("option")
          .data(measures)
          .join("option")
          .attr("selected", (d) => (d === selectedMeasure ? "selected" : null))
          .attr("value", (d) => d)
          .text((d) => d)
      );

    function destroy() {
      container.selectAll("*").remove();
    }
    return { destroy };
  }

  function renderYearControl(container, dispatch, years, selectedYears) {
    const label = container
      .append("label")
      .call((label) => label.append("span").text("Year Range: "))
      .append("span")
      .text(selectedYears.join(" – "));
    const slider = container.append("div").node();
    noUiSlider
      .create(slider, {
        start: years,
        step: 1,
        margin: 1,
        connect: true,
        range: {
          min: years[0],
          max: years[1],
        },
        format: {
          to: (value) => value,
          from: (value) => value,
        },
      })
      .on("slide", function (values) {
        label.text(values.join(" – "));
        dispatch.call("yearchange", null, values);
      });

    function destroy() {
      slider.noUiSlider.destroy();
      container.selectAll("*").remove();
    }
    return { destroy };
  }
}

const gdpLineChart = renderGDPLineChart();
// Destroy chart later
// gdpLineChart.destroy();
