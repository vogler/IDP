var margin = {top: 10, right: 50, bottom: 20, left: 50},
    width = 120 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

var chart = d3.box()
    .whiskers(iqr(1.5))
    .width(width)
    .height(height);

plotRow = undefined;
function boxPlot() {
  var data = [];
  var min = Infinity,
      max = -Infinity;

  if(plotRow) plotRow.remove();
  // plotRow = d3.select("#infoTable tbody").insert("tr", ":last-child"); // insert before. works with tr but not tbody... d3 bug?
  plotRow = d3.select("#infoTable tbody").append("tr");
  // hack: move the last row up with jQuery...
  var tr = $("#infoTable tr:last");
  tr.prev().before(tr);
  plotRow.append("td").text("Box Plot").style("text-align", "center");
  stats.info().forEach(function(x) {
    var durations = filterMap(x.times(), function(x){return timeExcluded(x[0]) ? undefined : x[1]}); // x[0] is the time, x[1] the duration
    data.push(durations);
    // if (d > max) max = d;
    // if (d < min) min = d;
    min = x.min();
    max = x.max();

    // console.log(data, min, max);
    chart.domain([min, max]);

    // update
    var td = plotRow.selectAll("td svg")
        .data(data);
    // enter
    td.enter().append("td").style("text-align", "center").append("svg")
        .attr("class", "box")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.bottom + margin.top)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .call(chart);
    // exit
    td.exit().remove();
  });
}

// Returns a function to compute the interquartile range.
function iqr(k) {
  return function(d, i) {
    var q1 = d.quartiles[0],
        q3 = d.quartiles[2],
        iqr = (q3 - q1) * k,
        i = -1,
        j = d.length;
    while (d[++i] < q1 - iqr);
    while (d[--j] > q3 + iqr);
    return [i, j];
  };
}