var margin = {top: 10, right: 50, bottom: 20, left: 50},
    width = 120 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

var chart = d3.box()
    .whiskers(iqr(1.5))
    .width(width)
    .height(height);

function boxPlot() {
  var data = [];
  var min = Infinity,
      max = -Infinity;

  // var row = d3.select("#infoTable tbody").append("tr");
  stats.info().forEach(function(x) {
    var durations = x.times().map(function(x){return x[1]}); // x[0] is the time, x[1] the duration
    data.push(durations);
    // if (d > max) max = d;
    // if (d < min) min = d;
    min = x.min();
    max = x.max();

    console.log(data, min, max);

    chart.domain([min, max]);

    // // var svg = d3.select("#infoTable tbody tr:last-child").selectAll("td svg")
    // var svg = row.selectAll("td svg")
    //     .data(data)
    //   // .enter().insert("svg", ":first-child") // equals prepend
    //   .enter().append("td").append("svg")
    //     .attr("class", "box")
    //     .attr("width", width + margin.left + margin.right)
    //     .attr("height", height + margin.bottom + margin.top)
    //   .append("g")
    //     .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    //     .call(chart);
    var svg = d3.select("body").selectAll("svg")
        .data(data)
      .enter().append("svg")
        .attr("class", "box")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.bottom + margin.top)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .call(chart);
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